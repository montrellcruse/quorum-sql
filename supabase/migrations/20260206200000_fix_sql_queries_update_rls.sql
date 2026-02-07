-- Fix: Restrict sql_queries UPDATE to prevent direct status/user_id/team_id modification
-- Issue #67: RLS policy on sql_queries UPDATE is too permissive

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Team members can update any team query" ON public.sql_queries;

-- Create a restrictive policy that allows team members to update query content
-- but prevents modifying status, user_id, or team_id directly
CREATE POLICY "Team members can update query content"
ON public.sql_queries
FOR UPDATE
TO authenticated
USING (
  user_can_access_team(auth.uid(), team_id)
)
WITH CHECK (
  user_can_access_team(auth.uid(), team_id)
);

-- Create a trigger to prevent direct modification of protected columns
-- Status changes must go through the stored procedure workflow
CREATE OR REPLACE FUNCTION public.protect_query_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing team_id (moving queries between teams)
  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'Cannot change query team_id directly';
  END IF;

  -- Prevent changing user_id (impersonating creator)
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change query user_id directly';
  END IF;

  -- Prevent changing status directly — must use submit/approve/reject procedures
  -- Security definer functions bypass this trigger via session variable
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('app.bypass_status_check', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot change query status directly. Use the approval workflow.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_query_columns_trigger ON public.sql_queries;
CREATE TRIGGER protect_query_columns_trigger
  BEFORE UPDATE ON public.sql_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_query_columns();

-- Update the submit function to set the bypass variable
-- Must drop first because return type changes from json to void
DROP FUNCTION IF EXISTS public.submit_query_for_approval(uuid, text, text, text, uuid, uuid);
CREATE OR REPLACE FUNCTION public.submit_query_for_approval(
  _query_id UUID,
  _new_sql TEXT DEFAULT NULL,
  _modified_by_email TEXT DEFAULT NULL,
  _change_reason TEXT DEFAULT NULL,
  _team_id UUID DEFAULT NULL,
  _user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
BEGIN
  -- Validate the query exists and user has access
  SELECT * INTO _query_record FROM sql_queries WHERE id = _query_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query not found';
  END IF;

  -- Verify caller is a team member
  IF NOT user_can_access_team(auth.uid(), _query_record.team_id) THEN
    RAISE EXCEPTION 'Not a team member';
  END IF;

  -- Set bypass flag for the status check trigger
  PERFORM set_config('app.bypass_status_check', 'true', true);

  -- Update the query SQL content if provided
  IF _new_sql IS NOT NULL THEN
    UPDATE sql_queries
    SET sql_content = _new_sql,
        status = 'pending_approval',
        last_modified_by_email = COALESCE(_modified_by_email, _query_record.last_modified_by_email),
        updated_at = now()
    WHERE id = _query_id;
  ELSE
    UPDATE sql_queries
    SET status = 'pending_approval',
        updated_at = now()
    WHERE id = _query_id;
  END IF;

  -- Create history record
  INSERT INTO query_history (query_id, sql_content, status, modified_by_email, change_reason)
  VALUES (
    _query_id,
    COALESCE(_new_sql, _query_record.sql_content),
    'pending_approval',
    COALESCE(_modified_by_email, _query_record.last_modified_by_email),
    _change_reason
  );

  -- Clear bypass flag
  PERFORM set_config('app.bypass_status_check', 'false', true);
END;
$$;

-- Update approve function to set the bypass variable
CREATE OR REPLACE FUNCTION public.approve_query_with_quota(
  _history_id UUID,
  _approver_id UUID,
  _approver_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
  _approval_count INTEGER;
  _quota INTEGER;
BEGIN
  -- Get the query via history
  SELECT q.*, qh.modified_by_email as history_email
  INTO _query_record
  FROM query_history qh
  JOIN sql_queries q ON q.id = qh.query_id
  WHERE qh.id = _history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found';
  END IF;

  -- Prevent self-approval (case-insensitive)
  IF lower(COALESCE(_approver_email, '')) = lower(COALESCE(_query_record.history_email, '')) THEN
    RAISE EXCEPTION 'Cannot approve your own changes';
  END IF;

  -- Check for duplicate approval
  IF EXISTS (SELECT 1 FROM query_approvals WHERE query_history_id = _history_id AND user_id = _approver_id) THEN
    RAISE EXCEPTION 'Already approved';
  END IF;

  -- Record the approval
  INSERT INTO query_approvals (query_history_id, user_id, approver_email)
  VALUES (_history_id, _approver_id, _approver_email);

  -- Check if quorum is met
  SELECT COUNT(*) INTO _approval_count
  FROM query_approvals WHERE query_history_id = _history_id;

  SELECT t.approval_quota INTO _quota
  FROM teams t WHERE t.id = _query_record.team_id;

  -- If quorum met, approve the query
  IF _approval_count >= COALESCE(_quota, 1) THEN
    PERFORM set_config('app.bypass_status_check', 'true', true);
    UPDATE sql_queries SET status = 'approved', updated_at = now()
    WHERE id = _query_record.id;
    PERFORM set_config('app.bypass_status_check', 'false', true);

    UPDATE query_history SET status = 'approved'
    WHERE id = _history_id;
  END IF;
END;
$$;

-- Update reject function with case-insensitive email and bypass
CREATE OR REPLACE FUNCTION public.reject_query_with_authorization(
  _history_id UUID,
  _rejecter_id UUID,
  _reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
BEGIN
  -- Get the query via history
  SELECT q.*
  INTO _query_record
  FROM query_history qh
  JOIN sql_queries q ON q.id = qh.query_id
  WHERE qh.id = _history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found';
  END IF;

  -- Verify rejecter is a team member
  IF NOT user_can_access_team(_rejecter_id, _query_record.team_id) THEN
    RAISE EXCEPTION 'Not a team member';
  END IF;

  -- Set bypass and update status
  PERFORM set_config('app.bypass_status_check', 'true', true);
  UPDATE sql_queries SET status = 'rejected', updated_at = now()
  WHERE id = _query_record.id;
  PERFORM set_config('app.bypass_status_check', 'false', true);

  UPDATE query_history SET status = 'rejected'
  WHERE id = _history_id;
END;
$$;

-- Add query_history, query_approvals, and approval workflow functions.
-- These exist in the Supabase migrations but were missing from the
-- server-only migration path (APPLY_SUPABASE_MIGRATIONS=false).

-- Helper: check team membership
CREATE OR REPLACE FUNCTION public.user_can_access_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

-- query_history (includes status + change_reason columns from later migrations)
CREATE TABLE IF NOT EXISTS public.query_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id uuid NOT NULL REFERENCES public.sql_queries(id) ON DELETE CASCADE,
  sql_content text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval',
  modified_by_email text NOT NULL,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_query_history_query_id ON public.query_history(query_id);

-- query_approvals (includes approver_email from later migrations)
CREATE TABLE IF NOT EXISTS public.query_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_history_id uuid NOT NULL REFERENCES public.query_history(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approver_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(query_history_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_query_approvals_query_history_id ON public.query_approvals(query_history_id);
CREATE INDEX IF NOT EXISTS idx_query_approvals_user_id ON public.query_approvals(user_id);

-- Protect direct status/team_id/user_id changes on sql_queries
CREATE OR REPLACE FUNCTION public.protect_query_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'Cannot change query team_id directly';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change query user_id directly';
  END IF;
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

-- Submit query for approval
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
  SELECT * INTO _query_record FROM sql_queries WHERE id = _query_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query not found';
  END IF;

  IF NOT user_can_access_team(auth.uid(), _query_record.team_id) THEN
    RAISE EXCEPTION 'Not a team member';
  END IF;

  PERFORM set_config('app.bypass_status_check', 'true', true);

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

  INSERT INTO query_history (query_id, sql_content, status, modified_by_email, change_reason)
  VALUES (
    _query_id,
    COALESCE(_new_sql, _query_record.sql_content),
    'pending_approval',
    COALESCE(_modified_by_email, _query_record.last_modified_by_email),
    _change_reason
  );

  PERFORM set_config('app.bypass_status_check', 'false', true);
END;
$$;

-- Approve query with quota check
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
  SELECT q.*, qh.modified_by_email as history_email
  INTO _query_record
  FROM query_history qh
  JOIN sql_queries q ON q.id = qh.query_id
  WHERE qh.id = _history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found';
  END IF;

  IF lower(COALESCE(_approver_email, '')) = lower(COALESCE(_query_record.history_email, '')) THEN
    RAISE EXCEPTION 'Cannot approve your own changes';
  END IF;

  IF EXISTS (SELECT 1 FROM query_approvals WHERE query_history_id = _history_id AND user_id = _approver_id) THEN
    RAISE EXCEPTION 'Already approved';
  END IF;

  INSERT INTO query_approvals (query_history_id, user_id, approver_email)
  VALUES (_history_id, _approver_id, _approver_email);

  SELECT COUNT(*) INTO _approval_count FROM query_approvals WHERE query_history_id = _history_id;
  SELECT t.approval_quota INTO _quota FROM teams t WHERE t.id = _query_record.team_id;

  IF _approval_count >= COALESCE(_quota, 1) THEN
    PERFORM set_config('app.bypass_status_check', 'true', true);
    UPDATE sql_queries SET status = 'approved', updated_at = now() WHERE id = _query_record.id;
    PERFORM set_config('app.bypass_status_check', 'false', true);
    UPDATE query_history SET status = 'approved' WHERE id = _history_id;
  END IF;
END;
$$;

-- Reject query
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
  SELECT q.* INTO _query_record
  FROM query_history qh
  JOIN sql_queries q ON q.id = qh.query_id
  WHERE qh.id = _history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found';
  END IF;

  IF NOT user_can_access_team(_rejecter_id, _query_record.team_id) THEN
    RAISE EXCEPTION 'Not a team member';
  END IF;

  PERFORM set_config('app.bypass_status_check', 'true', true);
  UPDATE sql_queries SET status = 'rejected', updated_at = now() WHERE id = _query_record.id;
  PERFORM set_config('app.bypass_status_check', 'false', true);
  UPDATE query_history SET status = 'rejected' WHERE id = _history_id;
END;
$$;

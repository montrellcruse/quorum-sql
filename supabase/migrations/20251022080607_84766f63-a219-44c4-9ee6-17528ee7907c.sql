-- Fix security vulnerabilities in approve_query_with_quota function
-- Add team membership check and SQL content length constraint

-- 1. Add team membership check to approval function
CREATE OR REPLACE FUNCTION public.approve_query_with_quota(
  _query_id uuid,
  _query_history_id uuid,
  _approver_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _query_record RECORD;
  _approval_count INTEGER;
  _approval_quota INTEGER;
  _already_approved BOOLEAN;
  _approver_email TEXT;
BEGIN
  -- Verify user is authenticated and matches the approver
  IF auth.uid() != _approver_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Get approver's email
  SELECT email INTO _approver_email
  FROM auth.users
  WHERE id = _approver_user_id;

  -- Get query details with approval quota from team
  SELECT sq.*, t.approval_quota INTO _query_record
  FROM sql_queries sq
  JOIN teams t ON sq.team_id = t.id
  WHERE sq.id = _query_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query not found'
    );
  END IF;

  -- SECURITY FIX: Verify approver is member of query's team
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = _approver_user_id
    AND team_id = _query_record.team_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not a team member'
    );
  END IF;

  -- Prevent approval if user was the last to modify (submit) the query
  -- This ensures peer review: you can't approve changes you submitted
  IF _query_record.last_modified_by_email = _approver_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot approve changes you submitted'
    );
  END IF;

  -- Verify query is pending approval
  IF _query_record.status != 'pending_approval' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query is not pending approval'
    );
  END IF;

  -- Check if user already approved
  SELECT EXISTS (
    SELECT 1 FROM query_approvals
    WHERE query_history_id = _query_history_id
    AND user_id = _approver_user_id
  ) INTO _already_approved;

  -- Add approval only if not already approved
  IF NOT _already_approved THEN
    INSERT INTO query_approvals (query_history_id, user_id)
    VALUES (_query_history_id, _approver_user_id);
  END IF;

  -- Count total approvals for this history record
  SELECT COUNT(*) INTO _approval_count
  FROM query_approvals
  WHERE query_history_id = _query_history_id;

  _approval_quota := _query_record.approval_quota;

  -- Check if approval quota is met
  IF _approval_count >= _approval_quota THEN
    UPDATE sql_queries
    SET status = 'approved', updated_at = now()
    WHERE id = _query_id;

    UPDATE query_history
    SET status = 'approved'
    WHERE id = _query_history_id;

    RETURN json_build_object(
      'success', true,
      'approved', true,
      'approval_count', _approval_count,
      'approval_quota', _approval_quota,
      'message', CASE 
        WHEN _already_approved THEN 'Query already approved by you and quota met'
        ELSE 'Query fully approved'
      END
    );
  ELSE
    IF _already_approved THEN
      RETURN json_build_object(
        'success', false,
        'error', 'You have already approved this query',
        'approval_count', _approval_count,
        'approval_quota', _approval_quota
      );
    ELSE
      RETURN json_build_object(
        'success', true,
        'approved', false,
        'approval_count', _approval_count,
        'approval_quota', _approval_quota,
        'message', 'Approval recorded'
      );
    END IF;
  END IF;
END;
$$;

-- 2. Add SQL content length constraint for security
ALTER TABLE sql_queries ADD CONSTRAINT sql_content_length CHECK (length(sql_content) <= 100000);
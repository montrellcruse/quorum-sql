-- Fix approve_query_with_quota to bypass RLS for status updates
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
BEGIN
  -- Verify user is authenticated and matches the approver
  IF auth.uid() != _approver_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

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

  -- Prevent self-approval
  IF _query_record.user_id = _approver_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot approve your own query'
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
  IF EXISTS (
    SELECT 1 FROM query_approvals
    WHERE query_history_id = _query_history_id
    AND user_id = _approver_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You have already approved this query'
    );
  END IF;

  -- Add approval
  INSERT INTO query_approvals (query_history_id, user_id)
  VALUES (_query_history_id, _approver_user_id);

  -- Count total approvals for this history record
  SELECT COUNT(*) INTO _approval_count
  FROM query_approvals
  WHERE query_history_id = _query_history_id;

  _approval_quota := _query_record.approval_quota;

  -- Check if approval quota is met
  IF _approval_count >= _approval_quota THEN
    -- Update query status to approved
    UPDATE sql_queries
    SET status = 'approved', updated_at = now()
    WHERE id = _query_id;

    -- Update history status to approved
    UPDATE query_history
    SET status = 'approved'
    WHERE id = _query_history_id;

    RETURN json_build_object(
      'success', true,
      'approved', true,
      'approval_count', _approval_count,
      'approval_quota', _approval_quota,
      'message', 'Query fully approved'
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
END;
$$;
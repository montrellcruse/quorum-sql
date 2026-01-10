-- Create secure reject query function with authorization checks
CREATE OR REPLACE FUNCTION public.reject_query_with_authorization(_query_id uuid, _query_history_id uuid, _rejecter_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  _query_record RECORD;
  _rejecter_email TEXT;
BEGIN
  -- Verify user is authenticated and matches the rejecter
  IF auth.uid() != _rejecter_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Get rejecter's email
  SELECT email INTO _rejecter_email
  FROM auth.users
  WHERE id = _rejecter_user_id;

  IF _rejecter_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Get query details
  SELECT sq.* INTO _query_record
  FROM sql_queries sq
  WHERE sq.id = _query_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query not found'
    );
  END IF;

  -- SECURITY: Verify rejecter is member of query's team
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = _rejecter_user_id
    AND team_id = _query_record.team_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not a team member'
    );
  END IF;

  -- SECURITY: Prevent self-rejection (peer review enforcement)
  IF _query_record.last_modified_by_email = _rejecter_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot reject changes you submitted'
    );
  END IF;

  -- Verify query is pending approval
  IF _query_record.status != 'pending_approval' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query is not pending approval'
    );
  END IF;

  -- Update query status back to draft
  UPDATE sql_queries
  SET status = 'draft', updated_at = now()
  WHERE id = _query_id;

  -- Update history record status
  UPDATE query_history
  SET status = 'rejected'
  WHERE id = _query_history_id;

  -- Clear any existing approvals for this history record
  DELETE FROM query_approvals
  WHERE query_history_id = _query_history_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Query rejected successfully'
  );
END;
$function$;
-- Fix the update_query_status function to NOT update last_modified_by_email
-- The last_modified_by_email should only be updated by the author when editing, not by the approver

CREATE OR REPLACE FUNCTION public.update_query_status(_query_id uuid, _new_status text, _modifier_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _query_record RECORD;
  _current_user_email TEXT;
  _result JSON;
BEGIN
  -- Get current authenticated user's email
  SELECT email INTO _current_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Verify user is authenticated
  IF _current_user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- Verify the modifier_email matches the authenticated user
  IF _modifier_email != _current_user_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Modifier email does not match authenticated user'
    );
  END IF;

  -- Get the query details
  SELECT * INTO _query_record
  FROM sql_queries
  WHERE id = _query_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query not found'
    );
  END IF;

  -- CRITICAL: Prevent self-approval
  IF _query_record.created_by_email = _current_user_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You cannot approve your own query. Peer review required.'
    );
  END IF;

  -- Validate status transitions
  IF _new_status NOT IN ('approved', 'rejected', 'draft') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid status. Must be approved, rejected, or draft.'
    );
  END IF;

  IF _query_record.status != 'pending_approval' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Can only approve/reject queries with pending_approval status'
    );
  END IF;

  -- Update query status ONLY - do NOT update last_modified_by_email
  -- The last_modified_by_email should only be updated by the author when editing
  UPDATE sql_queries
  SET 
    status = CASE 
      WHEN _new_status = 'rejected' THEN 'draft'
      ELSE _new_status
    END,
    updated_at = now()
  WHERE id = _query_id;

  -- Create history record if approved
  IF _new_status = 'approved' THEN
    INSERT INTO query_history (query_id, sql_content, modified_by_email, status)
    VALUES (_query_id, _query_record.sql_content, _modifier_email, 'approved');
  END IF;

  -- Update latest history record status to match query status
  UPDATE query_history
  SET status = CASE 
    WHEN _new_status = 'rejected' THEN 'rejected'
    ELSE _new_status
  END
  WHERE query_id = _query_id
  AND id = (
    SELECT id FROM query_history
    WHERE query_id = _query_id
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Query status updated successfully'
  );
END;
$function$;
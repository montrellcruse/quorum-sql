-- Create atomic function to handle query approval submission for single-person teams
-- This prevents race conditions by checking team member count and creating/updating records in a single transaction

CREATE OR REPLACE FUNCTION public.submit_query_for_approval(
  _query_id uuid,
  _sql_content text,
  _modified_by_email text,
  _change_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id uuid;
  _member_count integer;
  _history_id uuid;
  _status text;
BEGIN
  -- Get team_id from the query
  SELECT team_id INTO _team_id 
  FROM sql_queries 
  WHERE id = _query_id;
  
  IF _team_id IS NULL THEN
    RAISE EXCEPTION 'Query not found';
  END IF;
  
  -- Count team members with row lock to prevent race condition
  -- FOR UPDATE locks the team_members rows during this transaction
  SELECT COUNT(*) INTO _member_count
  FROM team_members
  WHERE team_id = _team_id
  FOR UPDATE;
  
  -- Determine status based on member count
  IF _member_count = 1 THEN
    _status := 'approved';
  ELSE
    _status := 'pending_approval';
  END IF;
  
  -- Create history record
  INSERT INTO query_history (
    query_id, 
    sql_content, 
    modified_by_email, 
    status, 
    change_reason
  )
  VALUES (
    _query_id, 
    _sql_content, 
    _modified_by_email, 
    _status, 
    NULLIF(_change_reason, '')
  )
  RETURNING id INTO _history_id;
  
  -- Update query status
  UPDATE sql_queries
  SET status = _status, updated_at = now()
  WHERE id = _query_id;
  
  -- Return result with status information
  RETURN json_build_object(
    'success', true,
    'status', _status,
    'auto_approved', _member_count = 1,
    'history_id', _history_id
  );
END;
$$;
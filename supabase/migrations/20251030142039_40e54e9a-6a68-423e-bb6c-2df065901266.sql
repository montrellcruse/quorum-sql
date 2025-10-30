-- Fix submit_query_for_approval function to handle single-member team auto-approval
-- Issue: FOR UPDATE cannot be used with aggregate functions
-- Solution: Lock rows in subquery, then count in outer query

CREATE OR REPLACE FUNCTION public.submit_query_for_approval(
  _query_id uuid,
  _sql_content text,
  _modified_by_email text,
  _change_reason text,
  _team_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _member_count integer;
  _history_id uuid;
  _status text;
BEGIN
  -- Verify user is a member of the team
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = _team_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this team';
  END IF;
  
  -- Count team members with row lock to prevent race condition
  -- FIX: Lock individual rows in subquery, then count in outer query
  SELECT COUNT(*) INTO _member_count
  FROM (
    SELECT 1 
    FROM team_members
    WHERE team_id = _team_id
    FOR UPDATE
  ) AS locked_members;
  
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
$function$;
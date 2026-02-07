-- Auto-approve queries for solo teams (1 member only).
-- When a team has a single member, there is no one else to approve,
-- so the query should be approved immediately on submission.

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
  _member_count INTEGER;
  _new_history_id UUID;
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
  )
  RETURNING id INTO _new_history_id;

  -- Auto-approve for solo teams (single member — no one else to approve)
  SELECT COUNT(*) INTO _member_count
  FROM team_members
  WHERE team_id = _query_record.team_id;

  IF _member_count <= 1 THEN
    UPDATE sql_queries
    SET status = 'approved', updated_at = now()
    WHERE id = _query_id;

    UPDATE query_history
    SET status = 'approved'
    WHERE id = _new_history_id;
  END IF;

  PERFORM set_config('app.bypass_status_check', 'false', true);
END;
$$;

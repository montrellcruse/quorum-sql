CREATE OR REPLACE FUNCTION public.submit_query_draft_for_approval(
  _query_id uuid,
  _change_reason text DEFAULT NULL,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL,
  _sql_content text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _actor_email text;
  _query_team_id uuid;
  _saved_draft public.sql_queries%ROWTYPE;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF char_length(_change_reason) > 1000 THEN
    RAISE EXCEPTION 'Change reason must be at most 1000 characters' USING ERRCODE = '22023';
  END IF;

  IF _title IS NULL THEN
    IF _description IS NOT NULL OR _sql_content IS NOT NULL THEN
      RAISE EXCEPTION 'Draft edits require a title and SQL content' USING ERRCODE = '22023';
    END IF;
  ELSIF char_length(_title) > 200 OR btrim(_title) = ''
     OR char_length(_description) > 1000
     OR _sql_content IS NULL OR btrim(_sql_content) = '' OR char_length(_sql_content) > 100000 THEN
    RAISE EXCEPTION 'Invalid draft edits' USING ERRCODE = '22023';
  END IF;

  SELECT team_id INTO _query_team_id FROM public.sql_queries WHERE id = _query_id;
  IF NOT FOUND OR NOT public.user_can_access_team(_actor_id, _query_team_id) THEN
    RAISE EXCEPTION 'Query not found' USING ERRCODE = 'P0002';
  END IF;

  -- Follow the lock order of the existing submission function: roster, then query.
  PERFORM 1 FROM public.team_members WHERE team_id = _query_team_id FOR UPDATE;
  SELECT * INTO _saved_draft FROM public.sql_queries WHERE id = _query_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query not found' USING ERRCODE = 'P0002';
  END IF;
  IF _saved_draft.status <> 'draft' THEN
    RAISE EXCEPTION 'Only drafts can be submitted for approval' USING ERRCODE = '22023';
  END IF;

  SELECT lower(btrim(email)) INTO _actor_email FROM auth.users WHERE id = _actor_id;
  IF _actor_email IS NULL THEN
    RAISE EXCEPTION 'Authenticated user has no email' USING ERRCODE = '42501';
  END IF;

  IF _title IS NOT NULL THEN
    UPDATE public.sql_queries
    SET title = _title, description = _description
    WHERE id = _query_id;
  END IF;

  -- The existing approval function updates SQL, status and history within this transaction.
  RETURN public.submit_query_for_approval(
    _query_id, coalesce(_sql_content, _saved_draft.sql_content), _actor_email,
    nullif(btrim(_change_reason), ''), _query_team_id, _actor_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_query_draft_for_approval(uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_query_draft_for_approval(uuid, text, text, text, text)
  TO authenticated;

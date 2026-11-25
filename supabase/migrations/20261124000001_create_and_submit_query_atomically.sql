CREATE OR REPLACE FUNCTION public.create_query_for_approval(
  _folder_id uuid,
  _team_id uuid,
  _title text,
  _sql_content text,
  _description text DEFAULT NULL,
  _change_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _actor_email text;
  _folder_team_id uuid;
  _query_id uuid;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF _title IS NULL OR btrim(_title) = '' OR char_length(_title) > 200
     OR _sql_content IS NULL OR btrim(_sql_content) = '' OR char_length(_sql_content) > 100000
     OR char_length(_description) > 1000 THEN
    RAISE EXCEPTION 'Invalid draft fields' USING ERRCODE = '22023';
  END IF;

  SELECT team_id INTO _folder_team_id FROM public.folders WHERE id = _folder_id FOR SHARE;
  IF NOT FOUND OR _folder_team_id IS DISTINCT FROM _team_id
     OR NOT public.user_can_access_team(_actor_id, _folder_team_id) THEN
    RAISE EXCEPTION 'Folder not found in the selected team' USING ERRCODE = 'P0002';
  END IF;

  SELECT lower(btrim(email)) INTO _actor_email FROM auth.users WHERE id = _actor_id;

  INSERT INTO public.sql_queries (
    folder_id, team_id, user_id, title, description, sql_content,
    created_by_email, last_modified_by_email
  ) VALUES (
    _folder_id, _folder_team_id, _actor_id, _title, _description, _sql_content,
    _actor_email, _actor_email
  ) RETURNING id INTO _query_id;

  PERFORM public.submit_query_draft_for_approval(_query_id, _change_reason);
  RETURN _query_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_query_for_approval(uuid, uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_query_for_approval(uuid, uuid, text, text, text, text)
  TO authenticated;

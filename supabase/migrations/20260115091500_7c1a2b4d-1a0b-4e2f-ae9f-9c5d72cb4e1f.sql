-- Convert personal teams to regular teams
CREATE OR REPLACE FUNCTION public.convert_personal_to_team(
  _team_id uuid,
  _new_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_is_team_admin(auth.uid(), _team_id) THEN
    RAISE EXCEPTION 'Only team admins can convert personal teams';
  END IF;

  UPDATE public.teams
  SET
    is_personal = false,
    name = COALESCE(NULLIF(_new_name, ''), name)
  WHERE id = _team_id AND is_personal = true;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_personal_to_team(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_personal_to_team(uuid, text) TO authenticated;

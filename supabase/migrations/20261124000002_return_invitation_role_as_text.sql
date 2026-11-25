CREATE OR REPLACE FUNCTION public.accept_team_invitation(_invitation_id uuid)
RETURNS TABLE (
  team_id uuid,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _user_email TEXT;
BEGIN
  SELECT email INTO _user_email
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  SELECT *
  INTO _invite
  FROM public.team_invitations
  WHERE id = _invitation_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;

  IF lower(_invite.invited_email) <> lower(_user_email) THEN
    RAISE EXCEPTION 'This invitation is for a different email';
  END IF;

  INSERT INTO public.team_members(team_id, user_id, role)
  VALUES (_invite.team_id, auth.uid(), _invite.role)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.team_invitations
  WHERE id = _invite.id;

  RETURN QUERY SELECT _invite.team_id, _invite.role::text;
END;
$$;

-- Add atomic invitation acceptance, pending approval aggregation, and ownership transfer helpers

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

  RETURN QUERY SELECT _invite.team_id, _invite.role;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pending_approvals(_team_id uuid, _exclude_email text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  folder_id uuid,
  last_modified_by_email text,
  updated_at timestamptz,
  folder_name text,
  approval_count integer,
  approval_quota integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.title,
    q.description,
    q.folder_id,
    COALESCE(q.last_modified_by_email, '') AS last_modified_by_email,
    q.updated_at,
    f.name AS folder_name,
    COALESCE(approvals.approval_count, 0) AS approval_count,
    t.approval_quota
  FROM public.sql_queries q
  JOIN public.folders f ON f.id = q.folder_id
  JOIN public.teams t ON t.id = q.team_id
  LEFT JOIN LATERAL (
    SELECT qh.id
    FROM public.query_history qh
    WHERE qh.query_id = q.id
    ORDER BY qh.created_at DESC
    LIMIT 1
  ) latest ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS approval_count
    FROM public.query_approvals qa
    WHERE qa.query_history_id = latest.id
  ) approvals ON TRUE
  WHERE q.team_id = _team_id
    AND q.status = 'pending_approval'
    AND (_exclude_email IS NULL OR q.last_modified_by_email IS DISTINCT FROM _exclude_email)
    AND public.user_can_access_team(auth.uid(), _team_id)
  ORDER BY q.updated_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_pending_approvals(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_approvals(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(_team_id uuid, _new_owner_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND admin_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the team owner can transfer ownership';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _new_owner_user_id
  ) THEN
    RAISE EXCEPTION 'New owner must be a team member';
  END IF;

  UPDATE public.team_members
  SET role = 'admin'
  WHERE team_id = _team_id
    AND user_id = _new_owner_user_id;

  UPDATE public.teams
  SET admin_id = _new_owner_user_id
  WHERE id = _team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_team_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership(uuid, uuid) TO authenticated;

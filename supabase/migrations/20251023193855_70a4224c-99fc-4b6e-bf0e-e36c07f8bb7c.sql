-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view teams they are invited to" ON public.teams;
DROP POLICY IF EXISTS "Users can view inviters profiles" ON public.profiles;

-- Create security definer function to get user's pending invitation team IDs
CREATE OR REPLACE FUNCTION public.user_pending_invitation_teams(_user_id uuid)
RETURNS TABLE(team_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.team_id
  FROM public.team_invitations ti
  JOIN public.profiles p ON p.email = ti.invited_email
  WHERE p.user_id = _user_id
    AND ti.status = 'pending';
$$;

-- Create security definer function to get IDs of people who invited the user
CREATE OR REPLACE FUNCTION public.user_inviters(_user_id uuid)
RETURNS TABLE(inviter_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.invited_by_user_id
  FROM public.team_invitations ti
  JOIN public.profiles p ON p.email = ti.invited_email
  WHERE p.user_id = _user_id
    AND ti.status = 'pending'
    AND ti.invited_by_user_id IS NOT NULL;
$$;

-- Recreate teams policy using the security definer function
CREATE POLICY "Users can view teams they are invited to"
ON public.teams
FOR SELECT
TO authenticated
USING (
  id IN (SELECT user_pending_invitation_teams(auth.uid()))
);

-- Recreate profiles policy using the security definer function
CREATE POLICY "Users can view inviters profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT user_inviters(auth.uid()))
);
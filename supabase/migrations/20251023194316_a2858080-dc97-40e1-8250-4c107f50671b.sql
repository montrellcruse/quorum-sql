-- Create security definer function to check for valid invitations
CREATE OR REPLACE FUNCTION public.user_has_valid_invitation(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    JOIN public.profiles p ON p.email = ti.invited_email
    WHERE ti.team_id = _team_id
      AND p.user_id = _user_id
      AND ti.status = 'pending'
  );
$$;

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can join teams with valid invitations" ON public.team_members;

-- Create new policy using the security definer function
CREATE POLICY "Users can join teams with valid invitations"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  user_has_valid_invitation(auth.uid(), team_id)
);
-- Add RLS policy to allow users to join teams with valid pending invitations
CREATE POLICY "Users can join teams with valid invitations"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    INNER JOIN public.profiles p ON p.email = ti.invited_email
    WHERE ti.team_id = team_members.team_id
      AND p.user_id = auth.uid()
      AND ti.status = 'pending'
  )
);
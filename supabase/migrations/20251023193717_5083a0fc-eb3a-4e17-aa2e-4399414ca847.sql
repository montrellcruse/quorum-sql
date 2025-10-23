-- Allow users to view teams they have pending invitations for
CREATE POLICY "Users can view teams they are invited to"
ON public.teams
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT team_id 
    FROM public.team_invitations 
    WHERE invited_email = (
      SELECT email FROM public.profiles WHERE user_id = auth.uid()
    ) 
    AND status = 'pending'
  )
);

-- Allow users to view profiles of people who invited them
CREATE POLICY "Users can view inviters profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT invited_by_user_id 
    FROM public.team_invitations 
    WHERE invited_email = (
      SELECT email FROM public.profiles WHERE user_id = auth.uid()
    ) 
    AND status = 'pending'
    AND invited_by_user_id IS NOT NULL
  )
);
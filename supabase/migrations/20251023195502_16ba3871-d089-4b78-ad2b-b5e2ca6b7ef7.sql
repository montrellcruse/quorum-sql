-- Allow users to delete invitations sent to their email
CREATE POLICY "Users can delete their own invitations"
ON public.team_invitations
FOR DELETE
TO authenticated
USING (
  invited_email = (
    SELECT email 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);
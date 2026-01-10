-- Add RLS policy to allow team members to view other team members' profiles
CREATE POLICY "Team members can view other team members' profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT tm.user_id
    FROM public.team_members tm
    WHERE tm.team_id IN (
      SELECT team_id
      FROM public.team_members
      WHERE user_id = auth.uid()
    )
  )
);
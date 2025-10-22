-- Allow owners and admins to delete queries
DROP POLICY IF EXISTS "Team admins can delete queries" ON public.sql_queries;

CREATE POLICY "Owners and admins can delete queries" 
ON public.sql_queries
FOR DELETE
USING (
  user_can_access_team(auth.uid(), team_id) AND 
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
);

-- Allow owners and admins to delete folders
DROP POLICY IF EXISTS "Team admins can delete folders" ON public.folders;

CREATE POLICY "Owners and admins can delete folders"
ON public.folders
FOR DELETE
USING (
  user_can_access_team(auth.uid(), team_id) AND
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
);

-- Allow owners and admins to update folders
DROP POLICY IF EXISTS "Team admins can update folders" ON public.folders;

CREATE POLICY "Owners and admins can update folders"
ON public.folders
FOR UPDATE
USING (
  user_can_access_team(auth.uid(), team_id) AND
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
)
WITH CHECK (
  user_can_access_team(auth.uid(), team_id) AND
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
);
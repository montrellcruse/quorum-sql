-- Drop the restrictive policy that only allows editing own drafts
DROP POLICY IF EXISTS "Users can update queries" ON public.sql_queries;

-- Create new collaborative policy allowing all team members to edit any team query
CREATE POLICY "Team members can update any team query"
ON public.sql_queries
FOR UPDATE
TO authenticated
USING (
  -- User must be a member of the query's team
  user_can_access_team(auth.uid(), team_id)
)
WITH CHECK (
  -- User must be a member of the query's team
  user_can_access_team(auth.uid(), team_id)
);
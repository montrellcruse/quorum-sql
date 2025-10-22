-- Fix teams INSERT policy - use direct check instead of function
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;

CREATE POLICY "Authenticated users can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (admin_id = auth.uid());

-- Fix query_history UPDATE policy to prevent recursion
DROP POLICY IF EXISTS "Team admins can update query history" ON public.query_history;

CREATE POLICY "Team admins can update query history"
ON public.query_history
FOR UPDATE
TO authenticated
USING (query_id IN (
  SELECT id FROM sql_queries
  WHERE team_id IN (SELECT user_admin_teams(auth.uid()))
));

-- Fix query_history DELETE policy to prevent recursion
DROP POLICY IF EXISTS "Team admins can delete query history" ON public.query_history;

CREATE POLICY "Team admins can delete query history"
ON public.query_history
FOR DELETE
TO authenticated
USING (query_id IN (
  SELECT id FROM sql_queries
  WHERE team_id IN (SELECT user_admin_teams(auth.uid()))
));
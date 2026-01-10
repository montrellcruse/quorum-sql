-- Drop and recreate the team creation policy with proper authentication scope
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;

CREATE POLICY "Authenticated users can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = admin_id);

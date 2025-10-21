-- Drop existing restrictive policies on projects table
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

-- Add team-wide policies for projects table
CREATE POLICY "Team members can view all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Team members can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Team members can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Team members can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies on sql_queries table
DROP POLICY IF EXISTS "Users can view their own queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Users can create their own queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Users can update their own queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Users can delete their own queries" ON public.sql_queries;

-- Add team-wide policies for sql_queries table
CREATE POLICY "Team members can view all queries"
ON public.sql_queries
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Team members can create queries"
ON public.sql_queries
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Team members can update queries"
ON public.sql_queries
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Team members can delete queries"
ON public.sql_queries
FOR DELETE
TO authenticated
USING (auth.role() = 'authenticated');

-- Drop existing restrictive policies on query_history table
DROP POLICY IF EXISTS "Users can view history for their queries" ON public.query_history;
DROP POLICY IF EXISTS "Users can create history for their queries" ON public.query_history;

-- Add team-wide policies for query_history table
CREATE POLICY "Team members can view all history"
ON public.query_history
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Team members can create history"
ON public.query_history
FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Team members can update history"
ON public.query_history
FOR UPDATE
TO authenticated
USING (auth.role() = 'authenticated');

CREATE POLICY "Team members can delete history"
ON public.query_history
FOR DELETE
TO authenticated
USING (auth.role() = 'authenticated');
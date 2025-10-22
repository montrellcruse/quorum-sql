-- Drop existing RLS policies on all tables
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins can update their teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins can delete their teams" ON public.teams;

DROP POLICY IF EXISTS "Team members can view their team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can delete team members" ON public.team_members;

DROP POLICY IF EXISTS "Team members can view their team folders" ON public.folders;
DROP POLICY IF EXISTS "Team members can create folders" ON public.folders;
DROP POLICY IF EXISTS "Team members can update their team folders" ON public.folders;
DROP POLICY IF EXISTS "Team members can delete their team folders" ON public.folders;

DROP POLICY IF EXISTS "Team members can view their team queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Team members can create queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Team members can update their team queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Team members can delete their team queries" ON public.sql_queries;

DROP POLICY IF EXISTS "Team members can view their team query history" ON public.query_history;
DROP POLICY IF EXISTS "Team members can create query history" ON public.query_history;
DROP POLICY IF EXISTS "Team members can update their team query history" ON public.query_history;
DROP POLICY IF EXISTS "Team members can delete their team query history" ON public.query_history;

-- Create new RLS policies for teams table
CREATE POLICY "Users can view teams they are members of"
  ON public.teams
  FOR SELECT
  USING (
    (SELECT 1 FROM public.team_members 
     WHERE team_members.team_id = teams.id 
       AND team_members.user_id = auth.uid()) IS NOT NULL
  );

CREATE POLICY "Team admins can update their teams"
  ON public.teams
  FOR UPDATE
  USING (
    (SELECT 1 FROM public.team_members 
     WHERE team_members.team_id = teams.id 
       AND team_members.user_id = auth.uid() 
       AND team_members.role = 'admin') IS NOT NULL
  );

CREATE POLICY "Authenticated users can create teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Team admins can delete their teams"
  ON public.teams
  FOR DELETE
  USING (admin_id = auth.uid());

-- Create new RLS policies for team_members table
CREATE POLICY "Users can view memberships for their teams"
  ON public.team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can insert team members"
  ON public.team_members
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Team admins can update team members"
  ON public.team_members
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Team admins can delete team members"
  ON public.team_members
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create new RLS policies for folders table
CREATE POLICY "Users can view folders for their teams"
  ON public.folders
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create folders"
  ON public.folders
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can update folders"
  ON public.folders
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Team admins can delete folders"
  ON public.folders
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create new RLS policies for sql_queries table
CREATE POLICY "Users can view queries for their teams"
  ON public.sql_queries
  FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create queries"
  ON public.sql_queries
  FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can update queries"
  ON public.sql_queries
  FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Team admins can delete queries"
  ON public.sql_queries
  FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create new RLS policies for query_history table
CREATE POLICY "Users can view query history for their teams"
  ON public.query_history
  FOR SELECT
  USING (
    query_id IN (
      SELECT id FROM public.sql_queries 
      WHERE team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Team members can create query history"
  ON public.query_history
  FOR INSERT
  WITH CHECK (
    query_id IN (
      SELECT id FROM public.sql_queries 
      WHERE team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Team admins can update query history"
  ON public.query_history
  FOR UPDATE
  USING (
    query_id IN (
      SELECT id FROM public.sql_queries 
      WHERE team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );

CREATE POLICY "Team admins can delete query history"
  ON public.query_history
  FOR DELETE
  USING (
    query_id IN (
      SELECT id FROM public.sql_queries 
      WHERE team_id IN (
        SELECT team_id FROM public.team_members 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );
-- Step 1: Drop all existing RLS policies from folders, sql_queries, and query_history
DROP POLICY IF EXISTS "Team members can create projects" ON public.folders;
DROP POLICY IF EXISTS "Team members can delete projects" ON public.folders;
DROP POLICY IF EXISTS "Team members can update projects" ON public.folders;
DROP POLICY IF EXISTS "Team members can view all projects" ON public.folders;

DROP POLICY IF EXISTS "Team members can create queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Team members can delete queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Team members can update query content" ON public.sql_queries;
DROP POLICY IF EXISTS "Team members can view all queries" ON public.sql_queries;

DROP POLICY IF EXISTS "Team members can create history" ON public.query_history;
DROP POLICY IF EXISTS "Team members can delete history" ON public.query_history;
DROP POLICY IF EXISTS "Team members can update history" ON public.query_history;
DROP POLICY IF EXISTS "Team members can view all history" ON public.query_history;

-- Step 2: Create teams table
CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  approval_quota integer NOT NULL DEFAULT 1,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Step 3: Create team_members join table
CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Add indexes for faster lookups
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);

-- Step 4: Add team_id to existing tables (nullable to preserve existing data)
ALTER TABLE public.folders ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.sql_queries ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

-- Add indexes for team_id lookups
CREATE INDEX idx_folders_team_id ON public.folders(team_id);
CREATE INDEX idx_sql_queries_team_id ON public.sql_queries(team_id);

-- Step 5: Enable RLS on new tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Step 6: Create helper function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
  );
$$;

-- Step 7: Create helper function to check if user is team admin
CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
      AND role = 'admin'
  );
$$;

-- Step 8: Create RLS policies for teams table
CREATE POLICY "Users can view their teams"
  ON public.teams
  FOR SELECT
  USING (public.is_team_member(id, auth.uid()));

CREATE POLICY "Team admins can update their teams"
  ON public.teams
  FOR UPDATE
  USING (public.is_team_admin(id, auth.uid()));

CREATE POLICY "Authenticated users can create teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Team admins can delete their teams"
  ON public.teams
  FOR DELETE
  USING (admin_id = auth.uid());

-- Step 9: Create RLS policies for team_members table
CREATE POLICY "Team members can view their team members"
  ON public.team_members
  FOR SELECT
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Team admins can insert team members"
  ON public.team_members
  FOR INSERT
  WITH CHECK (public.is_team_admin(team_id, auth.uid()));

CREATE POLICY "Team admins can update team members"
  ON public.team_members
  FOR UPDATE
  USING (public.is_team_admin(team_id, auth.uid()));

CREATE POLICY "Team admins can delete team members"
  ON public.team_members
  FOR DELETE
  USING (public.is_team_admin(team_id, auth.uid()));

-- Step 10: Create RLS policies for folders table
CREATE POLICY "Team members can view their team folders"
  ON public.folders
  FOR SELECT
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Team members can create folders"
  ON public.folders
  FOR INSERT
  WITH CHECK (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Team members can update their team folders"
  ON public.folders
  FOR UPDATE
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Team members can delete their team folders"
  ON public.folders
  FOR DELETE
  USING (public.is_team_member(team_id, auth.uid()));

-- Step 11: Create RLS policies for sql_queries table
CREATE POLICY "Team members can view their team queries"
  ON public.sql_queries
  FOR SELECT
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Team members can create queries"
  ON public.sql_queries
  FOR INSERT
  WITH CHECK (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Team members can update their team queries"
  ON public.sql_queries
  FOR UPDATE
  USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Team members can delete their team queries"
  ON public.sql_queries
  FOR DELETE
  USING (public.is_team_member(team_id, auth.uid()));

-- Step 12: Create RLS policies for query_history table
CREATE POLICY "Team members can view their team query history"
  ON public.query_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sql_queries
      WHERE sql_queries.id = query_history.query_id
        AND public.is_team_member(sql_queries.team_id, auth.uid())
    )
  );

CREATE POLICY "Team members can create query history"
  ON public.query_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sql_queries
      WHERE sql_queries.id = query_history.query_id
        AND public.is_team_member(sql_queries.team_id, auth.uid())
    )
  );

CREATE POLICY "Team members can update their team query history"
  ON public.query_history
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sql_queries
      WHERE sql_queries.id = query_history.query_id
        AND public.is_team_member(sql_queries.team_id, auth.uid())
    )
  );

CREATE POLICY "Team members can delete their team query history"
  ON public.query_history
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sql_queries
      WHERE sql_queries.id = query_history.query_id
        AND public.is_team_member(sql_queries.team_id, auth.uid())
    )
  );

-- Step 13: Add trigger for updated_at on teams table
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
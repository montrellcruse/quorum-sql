-- Fix infinite recursion in team_members RLS policies by using security definer functions

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view memberships for their teams" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can delete team members" ON public.team_members;

-- Create security definer functions to check team membership without triggering RLS
CREATE OR REPLACE FUNCTION public.user_teams(_user_id uuid)
RETURNS TABLE(team_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.user_admin_teams(_user_id uuid)
RETURNS TABLE(team_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = _user_id
    AND role = 'admin';
$$;

-- Recreate team_members policies using security definer functions
CREATE POLICY "Users can view memberships for their teams"
  ON public.team_members
  FOR SELECT
  USING (
    team_id IN (SELECT public.user_teams(auth.uid()))
  );

CREATE POLICY "Team admins can insert team members"
  ON public.team_members
  FOR INSERT
  WITH CHECK (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

CREATE POLICY "Team admins can update team members"
  ON public.team_members
  FOR UPDATE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

CREATE POLICY "Team admins can delete team members"
  ON public.team_members
  FOR DELETE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

-- Also update teams policies to use security definer functions
DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;
DROP POLICY IF EXISTS "Team admins can update their teams" ON public.teams;

CREATE POLICY "Users can view teams they are members of"
  ON public.teams
  FOR SELECT
  USING (
    id IN (SELECT public.user_teams(auth.uid()))
  );

CREATE POLICY "Team admins can update their teams"
  ON public.teams
  FOR UPDATE
  USING (
    id IN (SELECT public.user_admin_teams(auth.uid()))
  );

-- Update folders policies to use security definer functions
DROP POLICY IF EXISTS "Users can view folders for their teams" ON public.folders;
DROP POLICY IF EXISTS "Team members can create folders" ON public.folders;
DROP POLICY IF EXISTS "Team admins can update folders" ON public.folders;
DROP POLICY IF EXISTS "Team admins can delete folders" ON public.folders;

CREATE POLICY "Users can view folders for their teams"
  ON public.folders
  FOR SELECT
  USING (
    team_id IN (SELECT public.user_teams(auth.uid()))
  );

CREATE POLICY "Team members can create folders"
  ON public.folders
  FOR INSERT
  WITH CHECK (
    team_id IN (SELECT public.user_teams(auth.uid()))
  );

CREATE POLICY "Team admins can update folders"
  ON public.folders
  FOR UPDATE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

CREATE POLICY "Team admins can delete folders"
  ON public.folders
  FOR DELETE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

-- Update sql_queries policies to use security definer functions
DROP POLICY IF EXISTS "Users can view queries for their teams" ON public.sql_queries;
DROP POLICY IF EXISTS "Team members can create queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Team admins can update queries" ON public.sql_queries;
DROP POLICY IF EXISTS "Team admins can delete queries" ON public.sql_queries;

CREATE POLICY "Users can view queries for their teams"
  ON public.sql_queries
  FOR SELECT
  USING (
    team_id IN (SELECT public.user_teams(auth.uid()))
  );

CREATE POLICY "Team members can create queries"
  ON public.sql_queries
  FOR INSERT
  WITH CHECK (
    team_id IN (SELECT public.user_teams(auth.uid()))
  );

CREATE POLICY "Team admins can update queries"
  ON public.sql_queries
  FOR UPDATE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

CREATE POLICY "Team admins can delete queries"
  ON public.sql_queries
  FOR DELETE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );
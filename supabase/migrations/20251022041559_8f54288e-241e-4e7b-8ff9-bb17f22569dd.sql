-- ============================================
-- COMPREHENSIVE RLS POLICY REDESIGN
-- ============================================

-- Step 1: Create Security Definer Helper Functions
-- These prevent recursive RLS checks

-- Check if user can access a specific team
CREATE OR REPLACE FUNCTION public.user_can_access_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  );
$$;

-- Check if user is admin of a specific team
CREATE OR REPLACE FUNCTION public.user_is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'admin'
  );
$$;

-- Get team_id for a query
CREATE OR REPLACE FUNCTION public.get_query_team_id(_query_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.sql_queries
  WHERE id = _query_id;
$$;

-- Get team_id for a folder
CREATE OR REPLACE FUNCTION public.get_folder_team_id(_folder_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.folders
  WHERE id = _folder_id;
$$;

-- ============================================
-- Step 2: Drop ALL existing RLS policies
-- ============================================

-- Drop sql_queries policies
DROP POLICY IF EXISTS "Users can view queries for their teams" ON sql_queries;
DROP POLICY IF EXISTS "Team members can create queries" ON sql_queries;
DROP POLICY IF EXISTS "Team admins can update queries" ON sql_queries;
DROP POLICY IF EXISTS "Team admins can delete queries" ON sql_queries;

-- Drop folders policies
DROP POLICY IF EXISTS "Users can view folders for their teams" ON folders;
DROP POLICY IF EXISTS "Team members can create folders" ON folders;
DROP POLICY IF EXISTS "Team admins can update folders" ON folders;
DROP POLICY IF EXISTS "Team admins can delete folders" ON folders;

-- Drop query_history policies
DROP POLICY IF EXISTS "Users can view query history for their teams" ON query_history;
DROP POLICY IF EXISTS "Team members can create query history" ON query_history;
DROP POLICY IF EXISTS "Team admins can update query history" ON query_history;
DROP POLICY IF EXISTS "Team admins can delete query history" ON query_history;

-- ============================================
-- Step 3: Create NEW RLS Policies for sql_queries
-- ============================================

-- SELECT: Users can view queries from their teams
CREATE POLICY "Users can view team queries"
ON public.sql_queries
FOR SELECT
TO authenticated
USING (
  public.user_can_access_team(auth.uid(), team_id)
);

-- INSERT: Team members can create queries for their teams
CREATE POLICY "Team members can create queries"
ON public.sql_queries
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND team_id IS NOT NULL
  AND public.user_can_access_team(auth.uid(), team_id)
  AND user_id = auth.uid()
);

-- UPDATE: Users can update their own draft queries, admins can update any query
CREATE POLICY "Users can update queries"
ON public.sql_queries
FOR UPDATE
TO authenticated
USING (
  public.user_can_access_team(auth.uid(), team_id)
  AND (
    (user_id = auth.uid() AND status = 'draft')
    OR public.user_is_team_admin(auth.uid(), team_id)
  )
)
WITH CHECK (
  public.user_can_access_team(auth.uid(), team_id)
  AND (
    (user_id = auth.uid() AND status = 'draft')
    OR public.user_is_team_admin(auth.uid(), team_id)
  )
);

-- DELETE: Only team admins can delete queries
CREATE POLICY "Team admins can delete queries"
ON public.sql_queries
FOR DELETE
TO authenticated
USING (
  public.user_is_team_admin(auth.uid(), team_id)
);

-- ============================================
-- Step 4: Create NEW RLS Policies for folders
-- ============================================

-- SELECT: Users can view folders from their teams
CREATE POLICY "Users can view team folders"
ON public.folders
FOR SELECT
TO authenticated
USING (
  public.user_can_access_team(auth.uid(), team_id)
);

-- INSERT: Team members can create folders for their teams
CREATE POLICY "Team members can create folders"
ON public.folders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND team_id IS NOT NULL
  AND public.user_can_access_team(auth.uid(), team_id)
  AND user_id = auth.uid()
);

-- UPDATE: Only team admins can update folders
CREATE POLICY "Team admins can update folders"
ON public.folders
FOR UPDATE
TO authenticated
USING (
  public.user_is_team_admin(auth.uid(), team_id)
)
WITH CHECK (
  public.user_is_team_admin(auth.uid(), team_id)
);

-- DELETE: Only team admins can delete folders
CREATE POLICY "Team admins can delete folders"
ON public.folders
FOR DELETE
TO authenticated
USING (
  public.user_is_team_admin(auth.uid(), team_id)
);

-- ============================================
-- Step 5: Create NEW RLS Policies for query_history
-- ============================================

-- SELECT: Users can view history for queries they can access
CREATE POLICY "Users can view query history"
ON public.query_history
FOR SELECT
TO authenticated
USING (
  public.user_can_access_team(
    auth.uid(), 
    public.get_query_team_id(query_id)
  )
);

-- INSERT: Team members can create history for queries they can access
CREATE POLICY "Team members can create history"
ON public.query_history
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND public.user_can_access_team(
    auth.uid(), 
    public.get_query_team_id(query_id)
  )
);

-- UPDATE: Only team admins can update history
CREATE POLICY "Team admins can update history"
ON public.query_history
FOR UPDATE
TO authenticated
USING (
  public.user_is_team_admin(
    auth.uid(), 
    public.get_query_team_id(query_id)
  )
)
WITH CHECK (
  public.user_is_team_admin(
    auth.uid(), 
    public.get_query_team_id(query_id)
  )
);

-- DELETE: Only team admins can delete history
CREATE POLICY "Team admins can delete history"
ON public.query_history
FOR DELETE
TO authenticated
USING (
  public.user_is_team_admin(
    auth.uid(), 
    public.get_query_team_id(query_id)
  )
);

-- ============================================
-- Step 6: Make team_id NOT NULL (with safety checks)
-- ============================================

-- First, ensure no existing records have null team_id
-- If there are any, this will fail and alert us to fix data first
ALTER TABLE public.sql_queries 
ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE public.folders 
ALTER COLUMN team_id SET NOT NULL;
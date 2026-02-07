-- ============================================
-- SQL QUERY MANAGER - DATABASE SCHEMA
-- ============================================
-- 
-- This file documents the CURRENT database schema as of 2026-02-07.
-- 
-- IMPORTANT: This is DOCUMENTATION ONLY - it is NOT executed!
-- The actual schema is created by the squashed baseline migration in supabase/migrations/
-- 
-- Purpose: Provide a consolidated view of the database structure
-- for developers, auditors, and new contributors.
--
-- ============================================

-- ============================================
-- EXTENSIONS & TYPES
-- ============================================

CREATE EXTENSION IF NOT EXISTS citext;  -- Case-insensitive text for email comparisons

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'member');
  END IF;
END;
$$;

-- ============================================
-- TABLES OVERVIEW
-- ============================================
--
-- 1. profiles          - User profile information (synced from auth.users)
-- 2. teams             - Team management with approval quotas
-- 3. team_members      - User-team relationships with roles
-- 4. team_invitations  - Pending team invitations
-- 5. folders           - Hierarchical query organization
-- 6. sql_queries       - Versioned SQL query storage
-- 7. query_history     - Complete change history
-- 8. query_approvals   - Approval tracking for peer review
--
-- ============================================

-- ============================================
-- TABLE: profiles
-- ============================================
-- Stores user profile information synced with auth.users
-- 
-- Purpose: Expose user data in public schema for team operations
-- Sync: Automatically populated via trigger on auth.users insert
-- RLS: Users can view their own profile and teammates' profiles
--
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies (5):
-- 1. Users can view their own profile
-- 2. Team members can view other team members' profiles
-- 3. Users can view inviters' profiles
-- 4. Users can update their own profile
-- 5. Users can insert their own profile

-- ============================================
-- TABLE: teams
-- ============================================
-- Stores team information with configurable approval quotas
--
-- Purpose: Multi-tenant team management
-- Approval Quota: Number of approvals required for query changes
-- Admin ID: Primary team owner (can be transferred)
-- is_personal: True for auto-created personal workspaces
--
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  approval_quota INTEGER NOT NULL DEFAULT 1,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_personal BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON COLUMN public.teams.is_personal IS 'True for auto-created personal workspaces. False for collaborative teams.';

-- RLS Policies (5):
-- 1. Authenticated users can create teams (via can_create_team function)
-- 2. Users can view teams they are members of
-- 3. Users can view teams they are invited to
-- 4. Team admins can update their teams
-- 5. Team admins can delete their teams

-- ============================================
-- TABLE: team_members
-- ============================================
-- Maps users to teams with role-based access
--
-- Purpose: Define team membership and permissions
-- Roles: 'admin' (full access) or 'member' (limited access) via app_role enum
-- Constraint: Each user can only have one role per team
--
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member'::public.app_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(team_id, user_id)
);

-- RLS Policies (5):
-- 1. Users can view memberships for their teams
-- 2. Team admins can insert team members
-- 3. Team admins can update team members
-- 4. Team admins can delete team members
-- 5. Users can join teams with valid invitations

-- ============================================
-- TABLE: team_invitations
-- ============================================
-- Tracks pending invitations to teams
--
-- Purpose: Manage team invitation workflow
-- Status: 'pending', 'accepted', or 'revoked'
-- Email: Invitation sent to this email address
--
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member'::public.app_role,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE(team_id, invited_email)
);

COMMENT ON COLUMN public.team_invitations.invited_by_user_id IS 'User who sent the invitation';

-- RLS Policies (7):
-- 1. Team admins can view invitations
-- 2. Team admins can create invitations
-- 3. Team admins can update invitations
-- 4. Team admins can delete invitations
-- 5. Users can view their own pending invitations
-- 6. Users can update their own pending invitations
-- 7. Users can delete their own invitations

-- ============================================
-- TABLE: folders
-- ============================================
-- Hierarchical organization for queries
--
-- Purpose: Tree structure for organizing SQL queries
-- Parent Folder ID: NULL for root folders, UUID for subfolders (CASCADE delete)
-- Team Scoped: All folders belong to a team
--
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT,
  parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE
);

-- RLS Policies (4):
-- 1. Users can view team folders
-- 2. Team members can create folders
-- 3. Owners and admins can update folders
-- 4. Owners and admins can delete folders

-- ============================================
-- TABLE: sql_queries
-- ============================================
-- Stores SQL queries with approval workflow
--
-- Purpose: Version-controlled SQL query storage
-- Status: 'draft' | 'pending_approval' | 'approved'
-- Workflow: Draft → Pending Approval → Approved
-- Content Limit: 100KB max via CHECK constraint
--
CREATE TABLE IF NOT EXISTS public.sql_queries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sql_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_modified_by_email TEXT,
  created_by_email TEXT,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  CONSTRAINT sql_content_length CHECK (length(sql_content) <= 100000)
);

-- RLS Policies (4):
-- 1. Users can view team queries
-- 2. Team members can create queries
-- 3. Team members can update query content (protected columns guarded by trigger)
-- 4. Owners and admins can delete queries

-- ============================================
-- TABLE: query_history
-- ============================================
-- Complete change history for queries
--
-- Purpose: Audit trail for all query modifications
-- Change Reason: User-provided reason for the change
-- Status: Approval status of this version
--
CREATE TABLE IF NOT EXISTS public.query_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID NOT NULL REFERENCES public.sql_queries(id) ON DELETE CASCADE,
  sql_content TEXT NOT NULL,
  modified_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending_approval',
  change_reason TEXT,

  CONSTRAINT query_history_status_check CHECK (status IN ('pending_approval', 'approved', 'rejected'))
);

-- RLS Policies (4):
-- 1. Users can view query history
-- 2. Team members can create history
-- 3. Team admins can update history
-- 4. Team admins can delete history

-- ============================================
-- TABLE: query_approvals
-- ============================================
-- Tracks approvals for query changes
--
-- Purpose: Record peer review approvals
-- Constraint: One approval per user per query version
-- Enforcement: Self-approval prevented at function level
--
CREATE TABLE IF NOT EXISTS public.query_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_history_id UUID NOT NULL REFERENCES public.query_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(query_history_id, user_id)
);

-- RLS Policies (3):
-- 1. Users can view approvals for their team queries
-- 2. Team members can create approvals
-- 3. Users can delete their own approvals

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
-- All tables have RLS enabled with 37+ policies

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sql_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================
-- Helper functions for RLS policies
-- All use SECURITY DEFINER + SET search_path = public
--

-- Returns teams a user belongs to
CREATE OR REPLACE FUNCTION user_teams(_user_id UUID)
RETURNS TABLE(team_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT team_id FROM team_members WHERE user_id = _user_id; $$;

-- Returns teams where user is admin
CREATE OR REPLACE FUNCTION user_admin_teams(_user_id UUID)
RETURNS TABLE(team_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT team_id FROM team_members WHERE user_id = _user_id AND role = 'admin'; $$;

-- Checks if user can access team
CREATE OR REPLACE FUNCTION user_can_access_team(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM team_members WHERE user_id = _user_id AND team_id = _team_id); $$;

-- Checks if user is team admin
CREATE OR REPLACE FUNCTION user_is_team_admin(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM team_members WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin'); $$;

-- Returns teams user has pending invitations for
CREATE OR REPLACE FUNCTION user_pending_invitation_teams(_user_id UUID)
RETURNS TABLE(team_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT team_id FROM team_invitations WHERE invited_email = (SELECT email FROM profiles WHERE user_id = _user_id) AND status = 'pending'; $$;

-- Returns user IDs of people who invited the user
CREATE OR REPLACE FUNCTION user_inviters(_user_id UUID)
RETURNS TABLE(inviter_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT invited_by_user_id FROM team_invitations WHERE invited_email = (SELECT email FROM profiles WHERE user_id = _user_id); $$;

-- Checks if user has valid invitation
CREATE OR REPLACE FUNCTION user_has_valid_invitation(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS(SELECT 1 FROM team_invitations WHERE team_id = _team_id AND invited_email = (SELECT email FROM profiles WHERE user_id = _user_id) AND status = 'pending'); $$;

-- Checks if user can create a team (must be the admin and authenticated)
CREATE OR REPLACE FUNCTION can_create_team(_admin_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT _admin_id = auth.uid() AND auth.uid() IS NOT NULL; $$;

-- Gets team ID for a query
CREATE OR REPLACE FUNCTION get_query_team_id(_query_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT team_id FROM sql_queries WHERE id = _query_id; $$;

-- Gets all folder paths (recursive CTE for breadcrumb navigation)
CREATE OR REPLACE FUNCTION get_all_folder_paths()
RETURNS TABLE (id UUID, full_path TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE folder_tree AS (
    SELECT f.id, f.name::text AS full_path, f.parent_folder_id
    FROM folders f WHERE f.parent_folder_id IS NULL
    UNION ALL
    SELECT f.id, (ft.full_path || ' / ' || f.name)::text, f.parent_folder_id
    FROM folders f JOIN folder_tree ft ON f.parent_folder_id = ft.id
  )
  SELECT ft.id, ft.full_path FROM folder_tree ft;
$$;

-- ============================================
-- APPROVAL WORKFLOW FUNCTIONS
-- ============================================

-- Protects sensitive columns on sql_queries from direct modification
-- (status, user_id, team_id can only be changed via stored procedures)
CREATE OR REPLACE FUNCTION protect_query_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'Cannot change team_id directly';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id directly';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND COALESCE(current_setting('app.bypass_status_check', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'Cannot change status directly. Use the approval workflow.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_query_columns_trigger
  BEFORE UPDATE ON public.sql_queries
  FOR EACH ROW
  EXECUTE FUNCTION protect_query_columns();

-- Submits query for approval (atomic, prevents race conditions)
-- Auto-approves for single-member teams
CREATE OR REPLACE FUNCTION submit_query_for_approval(
  _query_id UUID,
  _new_sql TEXT DEFAULT NULL,
  _modified_by_email TEXT DEFAULT NULL,
  _change_reason TEXT DEFAULT NULL,
  _team_id UUID DEFAULT NULL,
  _user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
  _member_count INTEGER;
  _status TEXT;
  _history_id UUID;
BEGIN
  SELECT * INTO _query_record FROM sql_queries WHERE id = _query_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Query not found'; END IF;

  IF NOT user_can_access_team(auth.uid(), _query_record.team_id) THEN
    RAISE EXCEPTION 'Not a team member';
  END IF;

  -- Lock team members and count for auto-approve check
  SELECT COUNT(*) INTO _member_count
  FROM (SELECT 1 FROM team_members WHERE team_id = _query_record.team_id FOR UPDATE) AS locked;

  IF _member_count = 1 THEN _status := 'approved';
  ELSE _status := 'pending_approval';
  END IF;

  -- Bypass the protect_query_columns trigger
  PERFORM set_config('app.bypass_status_check', 'true', true);

  IF _new_sql IS NOT NULL THEN
    UPDATE sql_queries SET sql_content = _new_sql, status = _status,
      last_modified_by_email = COALESCE(_modified_by_email, _query_record.last_modified_by_email),
      updated_at = now() WHERE id = _query_id;
  ELSE
    UPDATE sql_queries SET status = _status, updated_at = now() WHERE id = _query_id;
  END IF;

  INSERT INTO query_history (query_id, sql_content, status, modified_by_email, change_reason)
  VALUES (_query_id, COALESCE(_new_sql, _query_record.sql_content), _status,
    COALESCE(_modified_by_email, _query_record.last_modified_by_email), _change_reason)
  RETURNING id INTO _history_id;

  PERFORM set_config('app.bypass_status_check', 'false', true);

  RETURN json_build_object('status', _status, 'history_id', _history_id, 'auto_approved', _member_count = 1);
END;
$$;

-- Approves query with quota enforcement (prevents self-approval)
CREATE OR REPLACE FUNCTION approve_query_with_quota(
  _history_id UUID,
  _approver_user_id UUID,
  _approver_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
  _team_record RECORD;
  _approval_count INTEGER;
BEGIN
  SELECT qh.*, sq.id AS query_id, sq.team_id, sq.last_modified_by_email
  INTO _query_record FROM query_history qh
  JOIN sql_queries sq ON qh.query_id = sq.id WHERE qh.id = _history_id;

  IF _query_record.last_modified_by_email = _approver_email THEN
    RETURN json_build_object('success', false, 'error', 'Cannot approve changes you submitted');
  END IF;

  SELECT approval_quota INTO _team_record FROM teams WHERE id = _query_record.team_id;

  IF EXISTS(SELECT 1 FROM query_approvals WHERE query_history_id = _history_id AND user_id = _approver_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'You have already approved this change');
  END IF;

  INSERT INTO query_approvals (query_history_id, user_id) VALUES (_history_id, _approver_user_id);

  SELECT COUNT(*) INTO _approval_count FROM query_approvals WHERE query_history_id = _history_id;

  IF _approval_count >= _team_record.approval_quota THEN
    PERFORM set_config('app.bypass_status_check', 'true', true);
    UPDATE sql_queries SET sql_content = _query_record.sql_content, status = 'approved',
      last_modified_by_email = _query_record.modified_by_email, updated_at = now()
    WHERE id = _query_record.query_id;
    UPDATE query_history SET status = 'approved' WHERE id = _history_id;
    PERFORM set_config('app.bypass_status_check', 'false', true);
    RETURN json_build_object('success', true, 'fully_approved', true, 'approval_count', _approval_count, 'quota', _team_record.approval_quota);
  ELSE
    RETURN json_build_object('success', true, 'fully_approved', false, 'approval_count', _approval_count, 'quota', _team_record.approval_quota);
  END IF;
END;
$$;

-- Rejects query with authorization (prevents self-rejection)
CREATE OR REPLACE FUNCTION reject_query_with_authorization(
  _history_id UUID,
  _rejecter_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
BEGIN
  SELECT qh.*, sq.id AS query_id, sq.last_modified_by_email
  INTO _query_record FROM query_history qh
  JOIN sql_queries sq ON qh.query_id = sq.id WHERE qh.id = _history_id;

  IF _query_record.last_modified_by_email = _rejecter_email THEN
    RETURN json_build_object('success', false, 'error', 'Cannot reject changes you submitted');
  END IF;

  PERFORM set_config('app.bypass_status_check', 'true', true);
  UPDATE sql_queries SET status = 'draft', updated_at = now() WHERE id = _query_record.query_id;
  UPDATE query_history SET status = 'rejected' WHERE id = _history_id;
  DELETE FROM query_approvals WHERE query_history_id = _history_id;
  PERFORM set_config('app.bypass_status_check', 'false', true);

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON folders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sql_queries_updated_at BEFORE UPDATE ON sql_queries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_team_invitations_updated_at BEFORE UPDATE ON team_invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sync profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Auto-create personal team on profile insert
CREATE OR REPLACE FUNCTION create_personal_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _team_id UUID;
BEGIN
  INSERT INTO public.teams (name, admin_id, is_personal, approval_quota)
  VALUES (NEW.email || '''s Workspace', NEW.user_id, true, 1)
  RETURNING id INTO _team_id;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_team_id, NEW.user_id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_personal_team();

-- ============================================
-- INDEXES
-- ============================================
-- Performance indexes on frequently queried columns

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_teams_admin ON teams(admin_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_folders_team_id ON folders(team_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_sql_queries_team_id ON sql_queries(team_id);
CREATE INDEX IF NOT EXISTS idx_sql_queries_folder_id ON sql_queries(folder_id);
CREATE INDEX IF NOT EXISTS idx_query_history_query_id ON query_history(query_id);
CREATE INDEX IF NOT EXISTS idx_query_approvals_history_id ON query_approvals(query_history_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);

-- ============================================
-- NOTES
-- ============================================
--
-- 1. All tables have RLS enabled (37+ policies)
-- 2. Security definer functions use SET search_path = public
-- 3. Approval workflow prevents race conditions via row locking (FOR UPDATE)
-- 4. Peer review enforced at database level (no self-approval/rejection)
-- 5. Team isolation enforced via RLS policies
-- 6. Audit trail maintained in query_history
-- 7. Roles use app_role enum type ('admin', 'member')
-- 8. Case-insensitive email comparisons via citext extension
-- 9. Personal teams auto-created on user registration
-- 10. Protected columns (status, user_id, team_id) on sql_queries via trigger
-- 11. Auto-approval for single-member teams
--
-- For the complete executable schema, see:
--   supabase/migrations/00000000000000_squashed_baseline.sql
-- For the visual schema diagram, see:
--   supabase/ERD.md
--
-- ============================================

-- ============================================
-- SQL QUERY MANAGER - DATABASE SCHEMA
-- ============================================
-- 
-- This file documents the CURRENT database schema as of 2025-10-27.
-- 
-- IMPORTANT: This is DOCUMENTATION ONLY - it is NOT executed!
-- The actual schema is created by migration files in supabase/migrations/
-- 
-- Purpose: Provide a consolidated view of the database structure
-- for developers, auditors, and new contributors.
--
-- ============================================

-- ============================================
-- TABLES OVERVIEW
-- ============================================
--
-- 1. profiles          - User profile information
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
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
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
--
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  admin_id UUID NOT NULL,
  approval_quota INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies (5):
-- 1. Authenticated users can create teams
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
-- Roles: 'admin' (full access) or 'member' (limited access)
-- Constraint: Each user can only have one role per team
--
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
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
-- Status: 'pending', 'accepted', or 'declined'
-- Email: Invitation sent to this email address
--
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(team_id, invited_email, status)
);

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
-- Parent Folder ID: NULL for root folders, UUID for subfolders
-- Team Scoped: All folders belong to a team
--
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  parent_folder_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL,
  created_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
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
--
CREATE TABLE public.sql_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  folder_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sql_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved')),
  user_id UUID NOT NULL,
  created_by_email TEXT,
  last_modified_by_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies (4):
-- 1. Users can view team queries
-- 2. Team members can create queries
-- 3. Team members can update any team query
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
CREATE TABLE public.query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL,
  sql_content TEXT NOT NULL,
  modified_by_email TEXT NOT NULL,
  change_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
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
CREATE TABLE public.query_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_history_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(query_history_id, user_id)
);

-- RLS Policies (3):
-- 1. Users can view approvals for their team queries
-- 2. Team members can create approvals
-- 3. Users can delete their own approvals

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================
-- Helper functions for RLS policies
-- All use SET search_path = public for security
--

-- Returns teams a user belongs to
CREATE OR REPLACE FUNCTION user_teams(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM team_members WHERE user_id = _user_id;
$$;

-- Returns teams where user is admin
CREATE OR REPLACE FUNCTION user_admin_teams(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM team_members 
  WHERE user_id = _user_id AND role = 'admin';
$$;

-- Checks if user can access team
CREATE OR REPLACE FUNCTION user_can_access_team(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM team_members 
    WHERE user_id = _user_id AND team_id = _team_id
  );
$$;

-- Checks if user is team admin
CREATE OR REPLACE FUNCTION user_is_team_admin(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM team_members 
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin'
  );
$$;

-- Returns teams user has pending invitations for
CREATE OR REPLACE FUNCTION user_pending_invitation_teams(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM team_invitations
  WHERE invited_email = (SELECT email FROM profiles WHERE user_id = _user_id)
  AND status = 'pending';
$$;

-- Returns user IDs of people who invited the user
CREATE OR REPLACE FUNCTION user_inviters(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invited_by_user_id FROM team_invitations
  WHERE invited_email = (SELECT email FROM profiles WHERE user_id = _user_id);
$$;

-- Checks if user has valid invitation
CREATE OR REPLACE FUNCTION user_has_valid_invitation(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM team_invitations
    WHERE team_id = _team_id
    AND invited_email = (SELECT email FROM profiles WHERE user_id = _user_id)
    AND status = 'pending'
  );
$$;

-- Gets team ID for a query
CREATE OR REPLACE FUNCTION get_query_team_id(_query_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM sql_queries WHERE id = _query_id;
$$;

-- ============================================
-- APPROVAL WORKFLOW FUNCTIONS
-- ============================================
-- Database functions for approval management
--

-- Submits query for approval (atomic, prevents race conditions)
CREATE OR REPLACE FUNCTION submit_query_for_approval(
  _query_id UUID,
  _sql_content TEXT,
  _modified_by_email TEXT,
  _change_reason TEXT,
  _team_id UUID,
  _user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member_count INTEGER;
  _history_id UUID;
  _result JSON;
BEGIN
  -- Lock team_members rows to prevent race condition
  SELECT COUNT(*) INTO _member_count
  FROM team_members
  WHERE team_id = _team_id
  FOR UPDATE;

  -- Create history record
  INSERT INTO query_history (
    query_id,
    sql_content,
    modified_by_email,
    change_reason,
    status
  ) VALUES (
    _query_id,
    _sql_content,
    _modified_by_email,
    _change_reason,
    'pending_approval'
  ) RETURNING id INTO _history_id;

  -- Update query status
  IF _member_count = 1 THEN
    -- Auto-approve for single-member teams
    UPDATE sql_queries
    SET sql_content = _sql_content,
        status = 'approved',
        last_modified_by_email = _modified_by_email,
        updated_at = now()
    WHERE id = _query_id;

    UPDATE query_history
    SET status = 'approved'
    WHERE id = _history_id;

    _result := json_build_object(
      'success', true,
      'auto_approved', true,
      'history_id', _history_id
    );
  ELSE
    -- Multi-member teams need approval
    UPDATE sql_queries
    SET status = 'pending_approval',
        updated_at = now()
    WHERE id = _query_id;

    _result := json_build_object(
      'success', true,
      'auto_approved', false,
      'history_id', _history_id
    );
  END IF;

  RETURN _result;
END;
$$;

-- Approves query with quota enforcement
CREATE OR REPLACE FUNCTION approve_query_with_quota(
  _history_id UUID,
  _approver_user_id UUID,
  _approver_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
  _team_record RECORD;
  _approval_count INTEGER;
  _result JSON;
BEGIN
  -- Get query and history info
  SELECT qh.*, sq.id as query_id, sq.team_id, sq.last_modified_by_email
  INTO _query_record
  FROM query_history qh
  JOIN sql_queries sq ON qh.query_id = sq.id
  WHERE qh.id = _history_id;

  -- Prevent self-approval
  IF _query_record.last_modified_by_email = _approver_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot approve changes you submitted'
    );
  END IF;

  -- Get team approval quota
  SELECT approval_quota INTO _team_record
  FROM teams
  WHERE id = _query_record.team_id;

  -- Check if already approved by this user
  IF EXISTS(
    SELECT 1 FROM query_approvals
    WHERE query_history_id = _history_id
    AND user_id = _approver_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You have already approved this change'
    );
  END IF;

  -- Add approval
  INSERT INTO query_approvals (query_history_id, user_id)
  VALUES (_history_id, _approver_user_id);

  -- Count total approvals
  SELECT COUNT(*) INTO _approval_count
  FROM query_approvals
  WHERE query_history_id = _history_id;

  -- Check if quota met
  IF _approval_count >= _team_record.approval_quota THEN
    -- Update query with approved content
    UPDATE sql_queries
    SET sql_content = _query_record.sql_content,
        status = 'approved',
        last_modified_by_email = _query_record.modified_by_email,
        updated_at = now()
    WHERE id = _query_record.query_id;

    -- Update history status
    UPDATE query_history
    SET status = 'approved'
    WHERE id = _history_id;

    _result := json_build_object(
      'success', true,
      'fully_approved', true,
      'approval_count', _approval_count,
      'quota', _team_record.approval_quota
    );
  ELSE
    _result := json_build_object(
      'success', true,
      'fully_approved', false,
      'approval_count', _approval_count,
      'quota', _team_record.approval_quota
    );
  END IF;

  RETURN _result;
END;
$$;

-- Rejects query with authorization
CREATE OR REPLACE FUNCTION reject_query_with_authorization(
  _history_id UUID,
  _rejecter_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
  _result JSON;
BEGIN
  -- Get query info
  SELECT qh.*, sq.id as query_id, sq.last_modified_by_email
  INTO _query_record
  FROM query_history qh
  JOIN sql_queries sq ON qh.query_id = sq.id
  WHERE qh.id = _history_id;

  -- Prevent self-rejection
  IF _query_record.last_modified_by_email = _rejecter_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot reject changes you submitted'
    );
  END IF;

  -- Update query status back to draft
  UPDATE sql_queries
  SET status = 'draft',
      updated_at = now()
  WHERE id = _query_record.query_id;

  -- Update history status
  UPDATE query_history
  SET status = 'rejected'
  WHERE id = _history_id;

  -- Delete any existing approvals
  DELETE FROM query_approvals
  WHERE query_history_id = _history_id;

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sql_queries_updated_at
  BEFORE UPDATE ON sql_queries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_invitations_updated_at
  BEFORE UPDATE ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEXES
-- ============================================
-- Performance indexes on frequently queried columns

CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_folders_team_id ON folders(team_id);
CREATE INDEX idx_sql_queries_team_id ON sql_queries(team_id);
CREATE INDEX idx_sql_queries_folder_id ON sql_queries(folder_id);
CREATE INDEX idx_query_history_query_id ON query_history(query_id);
CREATE INDEX idx_query_approvals_history_id ON query_approvals(query_history_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(invited_email);

-- ============================================
-- NOTES
-- ============================================
--
-- 1. All tables have RLS enabled
-- 2. Security definer functions use SET search_path
-- 3. Approval workflow prevents race conditions via row locking
-- 4. Peer review enforced at database level (no self-approval)
-- 5. Team isolation enforced via RLS policies
-- 6. Audit trail maintained in query_history
-- 7. Role constraints enforced via CHECK constraints
--
-- For detailed RLS policy definitions, see migration files.
-- For visual schema diagram, see ERD.md
--
-- ============================================

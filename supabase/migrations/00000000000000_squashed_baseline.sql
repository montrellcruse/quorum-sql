-- Squashed baseline migration replacing historical iterative migrations.
-- Generated from final end-state definitions across prior migrations.

CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'member');
  END IF;
END;
$$;

-- Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  approval_quota INTEGER NOT NULL DEFAULT 1,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_personal BOOLEAN NOT NULL DEFAULT false
);

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

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member'::public.app_role,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

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

CREATE TABLE IF NOT EXISTS public.query_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_history_id UUID NOT NULL REFERENCES public.query_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(query_history_id, user_id)
);

COMMENT ON COLUMN public.team_invitations.invited_by_user_id IS 'User who sent the invitation';
COMMENT ON COLUMN public.teams.is_personal IS 'True for auto-created personal workspaces. False for collaborative teams.';

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sql_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.query_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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

CREATE OR REPLACE FUNCTION public.user_pending_invitation_teams(_user_id uuid)
RETURNS TABLE(team_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.team_id
  FROM public.team_invitations ti
  JOIN public.profiles p ON p.email = ti.invited_email
  WHERE p.user_id = _user_id
    AND ti.status = 'pending';
$$;

CREATE OR REPLACE FUNCTION public.user_inviters(_user_id uuid)
RETURNS TABLE(inviter_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ti.invited_by_user_id
  FROM public.team_invitations ti
  JOIN public.profiles p ON p.email = ti.invited_email
  WHERE p.user_id = _user_id
    AND ti.status = 'pending'
    AND ti.invited_by_user_id IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.user_has_valid_invitation(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_invitations ti
    JOIN public.profiles p ON p.email = ti.invited_email
    WHERE ti.team_id = _team_id
      AND p.user_id = _user_id
      AND ti.status = 'pending'
  );
$$;

CREATE OR REPLACE FUNCTION public.can_create_team(_admin_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _admin_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_all_folder_paths()
RETURNS TABLE (
  id uuid,
  full_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE folder_paths AS (
    -- Base case: root folders (no parent)
    SELECT 
      f.id,
      f.name,
      f.parent_folder_id,
      f.name AS path
    FROM folders f
    WHERE f.parent_folder_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child folders
    SELECT 
      f.id,
      f.name,
      f.parent_folder_id,
      fp.path || ' / ' || f.name AS path
    FROM folders f
    INNER JOIN folder_paths fp ON f.parent_folder_id = fp.id
  )
  SELECT 
    folder_paths.id,
    folder_paths.path AS full_path
  FROM folder_paths
  ORDER BY folder_paths.path;
$$;

CREATE OR REPLACE FUNCTION public.get_team_folder_paths(_team_id uuid)
 RETURNS TABLE(id uuid, full_path text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE folder_paths AS (
    -- Base case: root folders for this team only
    SELECT 
      f.id,
      f.name,
      f.parent_folder_id,
      f.name AS path
    FROM folders f
    WHERE f.parent_folder_id IS NULL
      AND f.team_id = _team_id
    
    UNION ALL
    
    -- Recursive case: child folders (inherently team-filtered via parent)
    SELECT 
      f.id,
      f.name,
      f.parent_folder_id,
      fp.path || ' / ' || f.name AS path
    FROM folders f
    INNER JOIN folder_paths fp ON f.parent_folder_id = fp.id
  )
  SELECT 
    folder_paths.id,
    folder_paths.path AS full_path
  FROM folder_paths
  ORDER BY folder_paths.path;
$function$;

CREATE OR REPLACE FUNCTION public.protect_query_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing team_id (moving queries between teams)
  IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'Cannot change query team_id directly';
  END IF;

  -- Prevent changing user_id (impersonating creator)
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change query user_id directly';
  END IF;

  -- Prevent changing status directly — must use submit/approve/reject procedures
  -- Security definer functions bypass this trigger via session variable
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF current_setting('app.bypass_status_check', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot change query status directly. Use the approval workflow.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_pending_invitations(_user_id UUID)
RETURNS TABLE (
  processed_count INTEGER,
  team_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_email TEXT;
  _invitation RECORD;
  _processed_count INTEGER := 0;
  _team_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Get user email
  SELECT email INTO _user_email
  FROM profiles
  WHERE user_id = _user_id;
  
  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Process all pending invitations for this email
  FOR _invitation IN
    SELECT id, team_id, role
    FROM team_invitations
    WHERE invited_email = _user_email
      AND status = 'pending'
  LOOP
    -- Add user to team (ignore if already exists)
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (_invitation.team_id, _user_id, _invitation.role)
    ON CONFLICT (team_id, user_id) DO NOTHING;
    
    -- Update invitation status
    UPDATE team_invitations
    SET status = 'accepted', updated_at = now()
    WHERE id = _invitation.id;
    
    _processed_count := _processed_count + 1;
    _team_ids := array_append(_team_ids, _invitation.team_id);
  END LOOP;
  
  RETURN QUERY SELECT _processed_count, _team_ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id uuid;
  _team_name text;
  _base_name text;
  _suffix int := 2;
BEGIN
  -- 1. Create profile (existing behavior)
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    )
  );

  -- 2. Create personal team
  _team_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', '') || '''s Workspace',
    NULLIF(NEW.raw_user_meta_data->>'name', '') || '''s Workspace',
    NULLIF(split_part(NEW.email, '@', 1), '') || '''s Workspace',
    'My Workspace'
  );
  _base_name := _team_name;

  -- Avoid duplicate names for the same owner
  WHILE EXISTS (
    SELECT 1 FROM public.teams WHERE admin_id = NEW.id AND name = _team_name
  ) LOOP
    _team_name := _base_name || ' ' || _suffix;
    _suffix := _suffix + 1;
  END LOOP;

  INSERT INTO public.teams (name, admin_id, approval_quota, is_personal)
  VALUES (_team_name, NEW.id, 1, true)
  RETURNING id INTO _team_id;

  -- 3. Add user as team admin
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_team_id, NEW.id, 'admin');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_team_with_admin(
  _team_name TEXT,
  _approval_quota INTEGER DEFAULT 1
)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  admin_id UUID,
  approval_quota INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _new_team_id UUID;
  _user_id UUID;
BEGIN
  -- Get the authenticated user ID
  _user_id := auth.uid();
  
  -- Verify user is authenticated
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify user exists in profiles
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;
  
  -- Create the team (admin_id is always the authenticated user)
  INSERT INTO teams (name, admin_id, approval_quota)
  VALUES (_team_name, _user_id, _approval_quota)
  RETURNING id INTO _new_team_id;
  
  -- Add the creator as an admin member
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (_new_team_id, _user_id, 'admin');
  
  -- Return the created team
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.admin_id,
    t.approval_quota,
    t.created_at
  FROM teams t
  WHERE t.id = _new_team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_team_invitation(_invitation_id uuid)
RETURNS TABLE (
  team_id uuid,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _user_email TEXT;
BEGIN
  SELECT email INTO _user_email
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF _user_email IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  SELECT *
  INTO _invite
  FROM public.team_invitations
  WHERE id = _invitation_id
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;

  IF lower(_invite.invited_email) <> lower(_user_email) THEN
    RAISE EXCEPTION 'This invitation is for a different email';
  END IF;

  INSERT INTO public.team_members(team_id, user_id, role)
  VALUES (_invite.team_id, auth.uid(), _invite.role)
  ON CONFLICT DO NOTHING;

  DELETE FROM public.team_invitations
  WHERE id = _invite.id;

  RETURN QUERY SELECT _invite.team_id, _invite.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(_team_id uuid, _new_owner_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND admin_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the team owner can transfer ownership';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = _team_id AND user_id = _new_owner_user_id
  ) THEN
    RAISE EXCEPTION 'New owner must be a team member';
  END IF;

  UPDATE public.team_members
  SET role = 'admin'
  WHERE team_id = _team_id
    AND user_id = _new_owner_user_id;

  UPDATE public.teams
  SET admin_id = _new_owner_user_id
  WHERE id = _team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_personal_to_team(
  _team_id uuid,
  _new_name text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_is_team_admin(auth.uid(), _team_id) THEN
    RAISE EXCEPTION 'Only team admins can convert personal teams';
  END IF;

  UPDATE public.teams
  SET
    is_personal = false,
    name = COALESCE(NULLIF(_new_name, ''), name)
  WHERE id = _team_id AND is_personal = true;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pending_approvals(_team_id uuid, _exclude_email text)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  folder_id uuid,
  last_modified_by_email text,
  updated_at timestamptz,
  folder_name text,
  approval_count integer,
  approval_quota integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.title,
    q.description,
    q.folder_id,
    COALESCE(q.last_modified_by_email, '') AS last_modified_by_email,
    q.updated_at,
    f.name AS folder_name,
    COALESCE(approvals.approval_count, 0) AS approval_count,
    t.approval_quota
  FROM public.sql_queries q
  JOIN public.folders f ON f.id = q.folder_id
  JOIN public.teams t ON t.id = q.team_id
  LEFT JOIN LATERAL (
    SELECT qh.id
    FROM public.query_history qh
    WHERE qh.query_id = q.id
    ORDER BY qh.created_at DESC
    LIMIT 1
  ) latest ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS approval_count
    FROM public.query_approvals qa
    WHERE qa.query_history_id = latest.id
  ) approvals ON TRUE
  WHERE q.team_id = _team_id
    AND q.status = 'pending_approval'
    AND (_exclude_email IS NULL OR q.last_modified_by_email IS DISTINCT FROM _exclude_email)
    AND public.user_can_access_team(auth.uid(), _team_id)
  ORDER BY q.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.update_query_status(_query_id uuid, _new_status text, _modifier_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _query_record RECORD;
  _current_user_email TEXT;
  _result JSON;
BEGIN
  -- Get current authenticated user's email
  SELECT email INTO _current_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Verify user is authenticated
  IF _current_user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not authenticated'
    );
  END IF;

  -- Verify the modifier_email matches the authenticated user
  IF _modifier_email != _current_user_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Modifier email does not match authenticated user'
    );
  END IF;

  -- Get the query details
  SELECT * INTO _query_record
  FROM sql_queries
  WHERE id = _query_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query not found'
    );
  END IF;

  -- CRITICAL: Prevent self-approval
  IF _query_record.created_by_email = _current_user_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'You cannot approve your own query. Peer review required.'
    );
  END IF;

  -- Validate status transitions
  IF _new_status NOT IN ('approved', 'rejected', 'draft') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid status. Must be approved, rejected, or draft.'
    );
  END IF;

  IF _query_record.status != 'pending_approval' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Can only approve/reject queries with pending_approval status'
    );
  END IF;

  -- Update query status ONLY - do NOT update last_modified_by_email
  -- The last_modified_by_email should only be updated by the author when editing
  UPDATE sql_queries
  SET 
    status = CASE 
      WHEN _new_status = 'rejected' THEN 'draft'
      ELSE _new_status
    END,
    updated_at = now()
  WHERE id = _query_id;

  -- Update the latest history record status (DO NOT create a new record)
  -- This preserves the original author's email in modified_by_email
  UPDATE query_history
  SET status = CASE 
    WHEN _new_status = 'rejected' THEN 'rejected'
    ELSE _new_status
  END
  WHERE query_id = _query_id
  AND id = (
    SELECT id FROM query_history
    WHERE query_id = _query_id
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Query status updated successfully'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_query_for_approval(
  _query_id uuid,
  _sql_content text,
  _modified_by_email text,
  _change_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id uuid;
  _member_count integer;
  _history_id uuid;
  _status text;
BEGIN
  -- Get team_id from the query
  SELECT team_id INTO _team_id 
  FROM sql_queries 
  WHERE id = _query_id;
  
  IF _team_id IS NULL THEN
    RAISE EXCEPTION 'Query not found';
  END IF;
  
  -- Count team members with row lock to prevent race condition
  -- FOR UPDATE locks the team_members rows during this transaction
  SELECT COUNT(*) INTO _member_count
  FROM team_members
  WHERE team_id = _team_id
  FOR UPDATE;
  
  -- Determine status based on member count
  IF _member_count = 1 THEN
    _status := 'approved';
  ELSE
    _status := 'pending_approval';
  END IF;
  
  -- Create history record
  INSERT INTO query_history (
    query_id, 
    sql_content, 
    modified_by_email, 
    status, 
    change_reason
  )
  VALUES (
    _query_id, 
    _sql_content, 
    _modified_by_email, 
    _status, 
    NULLIF(_change_reason, '')
  )
  RETURNING id INTO _history_id;
  
  -- Update query status
  UPDATE sql_queries
  SET status = _status, updated_at = now()
  WHERE id = _query_id;
  
  -- Return result with status information
  RETURN json_build_object(
    'success', true,
    'status', _status,
    'auto_approved', _member_count = 1,
    'history_id', _history_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_query_for_approval(
  _query_id UUID,
  _new_sql TEXT DEFAULT NULL,
  _modified_by_email TEXT DEFAULT NULL,
  _change_reason TEXT DEFAULT NULL,
  _team_id UUID DEFAULT NULL,
  _user_id UUID DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
  _member_count integer;
  _status text;
  _history_id uuid;
BEGIN
  -- Validate the query exists and user has access
  SELECT * INTO _query_record FROM sql_queries WHERE id = _query_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Query not found';
  END IF;

  -- Verify caller is a team member
  IF NOT user_can_access_team(auth.uid(), _query_record.team_id) THEN
    RAISE EXCEPTION 'Not a team member';
  END IF;

  -- Count team members with row lock to prevent race condition
  SELECT COUNT(*) INTO _member_count
  FROM (
    SELECT 1 FROM team_members
    WHERE team_id = _query_record.team_id
    FOR UPDATE
  ) AS locked_members;

  -- Auto-approve for single-member teams
  IF _member_count = 1 THEN
    _status := 'approved';
  ELSE
    _status := 'pending_approval';
  END IF;

  -- Set bypass flag for the status check trigger
  PERFORM set_config('app.bypass_status_check', 'true', true);

  -- Update the query SQL content if provided
  IF _new_sql IS NOT NULL THEN
    UPDATE sql_queries
    SET sql_content = _new_sql,
        status = _status,
        last_modified_by_email = COALESCE(_modified_by_email, _query_record.last_modified_by_email),
        updated_at = now()
    WHERE id = _query_id;
  ELSE
    UPDATE sql_queries
    SET status = _status,
        updated_at = now()
    WHERE id = _query_id;
  END IF;

  -- Create history record
  INSERT INTO query_history (query_id, sql_content, status, modified_by_email, change_reason)
  VALUES (
    _query_id,
    COALESCE(_new_sql, _query_record.sql_content),
    _status,
    COALESCE(_modified_by_email, _query_record.last_modified_by_email),
    _change_reason
  )
  RETURNING id INTO _history_id;

  -- Clear bypass flag
  PERFORM set_config('app.bypass_status_check', 'false', true);

  RETURN json_build_object(
    'status', _status,
    'history_id', _history_id,
    'auto_approved', _member_count = 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_query_with_quota(
  _query_id uuid,
  _query_history_id uuid,
  _approver_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  _query_record RECORD;
  _approval_count INTEGER;
  _approval_quota INTEGER;
  _already_approved BOOLEAN;
  _approver_email TEXT;
BEGIN
  -- Verify user is authenticated and matches the approver
  IF auth.uid() != _approver_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Get approver's email
  SELECT email INTO _approver_email
  FROM auth.users
  WHERE id = _approver_user_id;

  -- Get query details with approval quota from team
  SELECT sq.*, t.approval_quota INTO _query_record
  FROM sql_queries sq
  JOIN teams t ON sq.team_id = t.id
  WHERE sq.id = _query_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query not found'
    );
  END IF;

  -- SECURITY FIX: Verify approver is member of query's team
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = _approver_user_id
    AND team_id = _query_record.team_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not a team member'
    );
  END IF;

  -- Prevent approval if user was the last to modify (submit) the query
  -- This ensures peer review: you can't approve changes you submitted
  IF _query_record.last_modified_by_email = _approver_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot approve changes you submitted'
    );
  END IF;

  -- Verify query is pending approval
  IF _query_record.status != 'pending_approval' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query is not pending approval'
    );
  END IF;

  -- Check if user already approved
  SELECT EXISTS (
    SELECT 1 FROM query_approvals
    WHERE query_history_id = _query_history_id
    AND user_id = _approver_user_id
  ) INTO _already_approved;

  -- Add approval only if not already approved
  IF NOT _already_approved THEN
    INSERT INTO query_approvals (query_history_id, user_id)
    VALUES (_query_history_id, _approver_user_id);
  END IF;

  -- Count total approvals for this history record
  SELECT COUNT(*) INTO _approval_count
  FROM query_approvals
  WHERE query_history_id = _query_history_id;

  _approval_quota := _query_record.approval_quota;

  -- Check if approval quota is met
  IF _approval_count >= _approval_quota THEN
    UPDATE sql_queries
    SET status = 'approved', updated_at = now()
    WHERE id = _query_id;

    UPDATE query_history
    SET status = 'approved'
    WHERE id = _query_history_id;

    RETURN json_build_object(
      'success', true,
      'approved', true,
      'approval_count', _approval_count,
      'approval_quota', _approval_quota,
      'message', CASE 
        WHEN _already_approved THEN 'Query already approved by you and quota met'
        ELSE 'Query fully approved'
      END
    );
  ELSE
    IF _already_approved THEN
      RETURN json_build_object(
        'success', false,
        'error', 'You have already approved this query',
        'approval_count', _approval_count,
        'approval_quota', _approval_quota
      );
    ELSE
      RETURN json_build_object(
        'success', true,
        'approved', false,
        'approval_count', _approval_count,
        'approval_quota', _approval_quota,
        'message', 'Approval recorded'
      );
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_query_with_quota(
  _history_id UUID,
  _approver_id UUID,
  _approver_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
  _approval_count INTEGER;
  _quota INTEGER;
BEGIN
  -- Get the query via history
  SELECT q.*, qh.modified_by_email as history_email
  INTO _query_record
  FROM query_history qh
  JOIN sql_queries q ON q.id = qh.query_id
  WHERE qh.id = _history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found';
  END IF;

  -- Prevent self-approval (case-insensitive)
  IF lower(COALESCE(_approver_email, '')) = lower(COALESCE(_query_record.history_email, '')) THEN
    RAISE EXCEPTION 'Cannot approve your own changes';
  END IF;

  -- Check for duplicate approval
  IF EXISTS (SELECT 1 FROM query_approvals WHERE query_history_id = _history_id AND user_id = _approver_id) THEN
    RAISE EXCEPTION 'Already approved';
  END IF;

  -- Record the approval
  INSERT INTO query_approvals (query_history_id, user_id, approver_email)
  VALUES (_history_id, _approver_id, _approver_email);

  -- Check if quorum is met
  SELECT COUNT(*) INTO _approval_count
  FROM query_approvals WHERE query_history_id = _history_id;

  SELECT t.approval_quota INTO _quota
  FROM teams t WHERE t.id = _query_record.team_id;

  -- If quorum met, approve the query
  IF _approval_count >= COALESCE(_quota, 1) THEN
    PERFORM set_config('app.bypass_status_check', 'true', true);
    UPDATE sql_queries SET status = 'approved', updated_at = now()
    WHERE id = _query_record.id;
    PERFORM set_config('app.bypass_status_check', 'false', true);

    UPDATE query_history SET status = 'approved'
    WHERE id = _history_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_query_with_authorization(_query_id uuid, _query_history_id uuid, _rejecter_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  _query_record RECORD;
  _rejecter_email TEXT;
BEGIN
  -- Verify user is authenticated and matches the rejecter
  IF auth.uid() != _rejecter_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Get rejecter's email
  SELECT email INTO _rejecter_email
  FROM auth.users
  WHERE id = _rejecter_user_id;

  IF _rejecter_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Get query details
  SELECT sq.* INTO _query_record
  FROM sql_queries sq
  WHERE sq.id = _query_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query not found'
    );
  END IF;

  -- SECURITY: Verify rejecter is member of query's team
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE user_id = _rejecter_user_id
    AND team_id = _query_record.team_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not a team member'
    );
  END IF;

  -- SECURITY: Prevent self-rejection (peer review enforcement)
  IF _query_record.last_modified_by_email = _rejecter_email THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot reject changes you submitted'
    );
  END IF;

  -- Verify query is pending approval
  IF _query_record.status != 'pending_approval' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Query is not pending approval'
    );
  END IF;

  -- Update query status back to draft
  UPDATE sql_queries
  SET status = 'draft', updated_at = now()
  WHERE id = _query_id;

  -- Update history record status
  UPDATE query_history
  SET status = 'rejected'
  WHERE id = _query_history_id;

  -- Clear any existing approvals for this history record
  DELETE FROM query_approvals
  WHERE query_history_id = _query_history_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Query rejected successfully'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_query_with_authorization(
  _history_id UUID,
  _rejecter_id UUID,
  _reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _query_record RECORD;
BEGIN
  -- Get the query via history
  SELECT q.*
  INTO _query_record
  FROM query_history qh
  JOIN sql_queries q ON q.id = qh.query_id
  WHERE qh.id = _history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'History record not found';
  END IF;

  -- Verify rejecter is a team member
  IF NOT user_can_access_team(_rejecter_id, _query_record.team_id) THEN
    RAISE EXCEPTION 'Not a team member';
  END IF;

  -- Set bypass and update status
  PERFORM set_config('app.bypass_status_check', 'true', true);
  UPDATE sql_queries SET status = 'rejected', updated_at = now()
  WHERE id = _query_record.id;
  PERFORM set_config('app.bypass_status_check', 'false', true);

  UPDATE query_history SET status = 'rejected'
  WHERE id = _history_id;
END;
$$;

-- Function grants/comments
COMMENT ON FUNCTION public.update_query_status IS 'Secure function to handle query approval/rejection. Enforces peer review by preventing self-approval and ensures atomic updates with history logging. All status changes for approval workflow MUST go through this function.';
GRANT EXECUTE ON FUNCTION public.update_query_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_pending_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_with_admin TO authenticated;
REVOKE ALL ON FUNCTION public.accept_team_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_pending_approvals(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_approvals(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.transfer_team_ownership(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.convert_personal_to_team(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_personal_to_team(uuid, text) TO authenticated;

-- Policies
DROP POLICY IF EXISTS "Owners and admins can delete folders" ON public.folders;
CREATE POLICY "Owners and admins can delete folders"
ON public.folders
FOR DELETE
USING (
  user_can_access_team(auth.uid(), team_id) AND
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
);

DROP POLICY IF EXISTS "Owners and admins can update folders" ON public.folders;
CREATE POLICY "Owners and admins can update folders"
ON public.folders
FOR UPDATE
USING (
  user_can_access_team(auth.uid(), team_id) AND
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
)
WITH CHECK (
  user_can_access_team(auth.uid(), team_id) AND
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
);

DROP POLICY IF EXISTS "Team members can create folders" ON public.folders;
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

DROP POLICY IF EXISTS "Users can view team folders" ON public.folders;
CREATE POLICY "Users can view team folders"
ON public.folders
FOR SELECT
TO authenticated
USING (
  public.user_can_access_team(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Team members can view other team members' profiles" ON public.profiles;
CREATE POLICY "Team members can view other team members' profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT tm.user_id
    FROM public.team_members tm
    WHERE tm.team_id IN (
      SELECT team_id
      FROM public.team_members
      WHERE user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view inviters profiles" ON public.profiles;
CREATE POLICY "Users can view inviters profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT user_inviters(auth.uid()))
);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Team members can create approvals" ON public.query_approvals;
CREATE POLICY "Team members can create approvals"
  ON public.query_approvals
  FOR INSERT
  WITH CHECK (
    query_history_id IN (
      SELECT qh.id FROM public.query_history qh
      JOIN public.sql_queries sq ON qh.query_id = sq.id
      WHERE sq.team_id IN (SELECT public.user_teams(auth.uid()))
    )
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can delete their own approvals" ON public.query_approvals;
CREATE POLICY "Users can delete their own approvals"
  ON public.query_approvals
  FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view approvals for their team queries" ON public.query_approvals;
CREATE POLICY "Users can view approvals for their team queries"
  ON public.query_approvals
  FOR SELECT
  USING (
    query_history_id IN (
      SELECT qh.id FROM public.query_history qh
      JOIN public.sql_queries sq ON qh.query_id = sq.id
      WHERE sq.team_id IN (SELECT public.user_teams(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Team admins can delete history" ON public.query_history;
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

DROP POLICY IF EXISTS "Team admins can update history" ON public.query_history;
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

DROP POLICY IF EXISTS "Team members can create history" ON public.query_history;
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

DROP POLICY IF EXISTS "Users can view query history" ON public.query_history;
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

DROP POLICY IF EXISTS "Owners and admins can delete queries" ON public.sql_queries;
CREATE POLICY "Owners and admins can delete queries" 
ON public.sql_queries
FOR DELETE
USING (
  user_can_access_team(auth.uid(), team_id) AND 
  (user_id = auth.uid() OR user_is_team_admin(auth.uid(), team_id))
);

DROP POLICY IF EXISTS "Team members can create queries" ON public.sql_queries;
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

DROP POLICY IF EXISTS "Team members can update query content" ON public.sql_queries;
CREATE POLICY "Team members can update query content"
ON public.sql_queries
FOR UPDATE
TO authenticated
USING (
  user_can_access_team(auth.uid(), team_id)
)
WITH CHECK (
  user_can_access_team(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Users can view team queries" ON public.sql_queries;
CREATE POLICY "Users can view team queries"
ON public.sql_queries
FOR SELECT
TO authenticated
USING (
  public.user_can_access_team(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Team admins can create invitations" ON public.team_invitations;
CREATE POLICY "Team admins can create invitations"
ON public.team_invitations
FOR INSERT
TO authenticated
WITH CHECK (team_id IN (SELECT user_admin_teams(auth.uid())));

DROP POLICY IF EXISTS "Team admins can delete invitations" ON public.team_invitations;
CREATE POLICY "Team admins can delete invitations"
ON public.team_invitations
FOR DELETE
TO authenticated
USING (team_id IN (SELECT user_admin_teams(auth.uid())));

DROP POLICY IF EXISTS "Team admins can update invitations" ON public.team_invitations;
CREATE POLICY "Team admins can update invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (team_id IN (SELECT user_admin_teams(auth.uid())));

DROP POLICY IF EXISTS "Team admins can view invitations" ON public.team_invitations;
CREATE POLICY "Team admins can view invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (team_id IN (SELECT user_admin_teams(auth.uid())));

DROP POLICY IF EXISTS "Users can delete their own invitations" ON public.team_invitations;
CREATE POLICY "Users can delete their own invitations"
ON public.team_invitations
FOR DELETE
TO authenticated
USING (
  invited_email = (
    SELECT email 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update their own pending invitations" ON public.team_invitations;
CREATE POLICY "Users can update their own pending invitations"
ON public.team_invitations
FOR UPDATE
TO authenticated
USING (invited_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) AND status = 'pending');

DROP POLICY IF EXISTS "Users can view their own pending invitations" ON public.team_invitations;
CREATE POLICY "Users can view their own pending invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (invited_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()) AND status = 'pending');

DROP POLICY IF EXISTS "Team admins can delete team members" ON public.team_members;
CREATE POLICY "Team admins can delete team members"
  ON public.team_members
  FOR DELETE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

DROP POLICY IF EXISTS "Team admins can insert team members" ON public.team_members;
CREATE POLICY "Team admins can insert team members"
  ON public.team_members
  FOR INSERT
  WITH CHECK (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

DROP POLICY IF EXISTS "Team admins can update team members" ON public.team_members;
CREATE POLICY "Team admins can update team members"
  ON public.team_members
  FOR UPDATE
  USING (
    team_id IN (SELECT public.user_admin_teams(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can join teams with valid invitations" ON public.team_members;
CREATE POLICY "Users can join teams with valid invitations"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  user_has_valid_invitation(auth.uid(), team_id)
);

DROP POLICY IF EXISTS "Users can view memberships for their teams" ON public.team_members;
CREATE POLICY "Users can view memberships for their teams"
  ON public.team_members
  FOR SELECT
  USING (
    team_id IN (SELECT public.user_teams(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;
CREATE POLICY "Authenticated users can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (admin_id = auth.uid());

DROP POLICY IF EXISTS "Team admins can delete their teams" ON public.teams;
CREATE POLICY "Team admins can delete their teams"
  ON public.teams
  FOR DELETE
  USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Team admins can update their teams" ON public.teams;
CREATE POLICY "Team admins can update their teams"
  ON public.teams
  FOR UPDATE
  USING (
    id IN (SELECT public.user_admin_teams(auth.uid()))
  );

DROP POLICY IF EXISTS "Users can view teams they are invited to" ON public.teams;
CREATE POLICY "Users can view teams they are invited to"
ON public.teams
FOR SELECT
TO authenticated
USING (
  id IN (SELECT user_pending_invitation_teams(auth.uid()))
);

DROP POLICY IF EXISTS "Users can view teams they are members of" ON public.teams;
CREATE POLICY "Users can view teams they are members of"
  ON public.teams
  FOR SELECT
  USING (
    id IN (SELECT public.user_teams(auth.uid()))
  );

-- Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.folders;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS protect_query_columns_trigger ON public.sql_queries;
CREATE TRIGGER protect_query_columns_trigger
  BEFORE UPDATE ON public.sql_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_query_columns();

DROP TRIGGER IF EXISTS update_sql_queries_updated_at ON public.sql_queries;
CREATE TRIGGER update_sql_queries_updated_at
  BEFORE UPDATE ON public.sql_queries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_invitations_updated_at ON public.team_invitations;
CREATE TRIGGER update_team_invitations_updated_at
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_teams_updated_at ON public.teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_folders_team_id ON public.folders(team_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));
CREATE INDEX IF NOT EXISTS idx_query_approvals_query_history_id ON public.query_approvals(query_history_id);
CREATE INDEX IF NOT EXISTS idx_query_approvals_user_id ON public.query_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_sql_queries_team_id ON public.sql_queries(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email_lower ON public.team_invitations (lower(invited_email));
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_by 
ON public.team_invitations(invited_by_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_unique_lower
  ON public.team_invitations (team_id, lower(invited_email), status);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_is_personal
ON public.teams(is_personal) WHERE is_personal = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON auth.users (lower(email));

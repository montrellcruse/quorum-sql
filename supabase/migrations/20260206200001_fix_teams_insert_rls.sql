-- Fix: Restrict teams INSERT to prevent arbitrary admin_id assignment
-- Issue #68: Teams INSERT RLS policy allows arbitrary admin_id

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;

-- Restore proper check: only allow creating teams where you are the admin
CREATE POLICY "Authenticated users can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (admin_id = auth.uid());

-- Update the security definer function to bypass RLS properly
-- The function already validates auth.uid() internally, so this is safe
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

-- Add personal workspace support for solo users
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_teams_is_personal
ON public.teams(is_personal) WHERE is_personal = true;

COMMENT ON COLUMN public.teams.is_personal IS
  'True for auto-created personal workspaces. False for collaborative teams.';

-- Replace the existing handle_new_user function to also create personal team
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

-- Create personal teams for existing users who have no teams
INSERT INTO public.teams (name, admin_id, approval_quota, is_personal)
SELECT
  COALESCE(
    NULLIF(p.full_name, '') || '''s Workspace',
    NULLIF(split_part(p.email, '@', 1), '') || '''s Workspace',
    'My Workspace'
  ),
  p.user_id,
  1,
  true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm WHERE tm.user_id = p.user_id
);

-- Add team membership for these new teams
INSERT INTO public.team_members (team_id, user_id, role)
SELECT t.id, t.admin_id, 'admin'
FROM public.teams t
WHERE t.is_personal = true
  AND NOT EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.team_id = t.id
  );

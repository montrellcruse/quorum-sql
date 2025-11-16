-- Create enum type for team roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- Convert team_members.role to use enum type
-- Drop CHECK constraint, drop default, alter type, re-add default
ALTER TABLE public.team_members 
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members 
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.team_members 
  ALTER COLUMN role TYPE app_role USING role::app_role;

ALTER TABLE public.team_members 
  ALTER COLUMN role SET DEFAULT 'member'::app_role;

-- Convert team_invitations.role to use enum type
-- Same process: drop constraint, drop default, alter type, re-add default
ALTER TABLE public.team_invitations 
  DROP CONSTRAINT IF EXISTS team_invitations_role_check;

ALTER TABLE public.team_invitations 
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.team_invitations 
  ALTER COLUMN role TYPE app_role USING role::app_role;

ALTER TABLE public.team_invitations 
  ALTER COLUMN role SET DEFAULT 'member'::app_role;
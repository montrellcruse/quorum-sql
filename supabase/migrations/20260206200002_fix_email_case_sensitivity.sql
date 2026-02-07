-- Fix: Email case sensitivity (Issue #78)
-- Ensure all email comparisons and unique constraints are case-insensitive

-- Enable citext extension for case-insensitive text
CREATE EXTENSION IF NOT EXISTS citext;

-- Normalize existing email data to lowercase
UPDATE auth.users SET email = lower(email) WHERE email IS DISTINCT FROM lower(email);
UPDATE public.profiles SET email = lower(email) WHERE email IS DISTINCT FROM lower(email);
UPDATE public.team_invitations SET invited_email = lower(invited_email) WHERE invited_email IS DISTINCT FROM lower(invited_email);
UPDATE public.sql_queries SET created_by_email = lower(created_by_email) WHERE created_by_email IS DISTINCT FROM lower(created_by_email);
UPDATE public.sql_queries SET last_modified_by_email = lower(last_modified_by_email) WHERE last_modified_by_email IS DISTINCT FROM lower(last_modified_by_email);
UPDATE public.folders SET created_by_email = lower(created_by_email) WHERE created_by_email IS DISTINCT FROM lower(created_by_email);

-- Add case-insensitive unique index on auth.users email (drop existing if any)
DROP INDEX IF EXISTS auth.idx_users_email_lower;
CREATE UNIQUE INDEX idx_users_email_lower ON auth.users (lower(email));

-- Add case-insensitive unique index on profiles email
DROP INDEX IF EXISTS public.idx_profiles_email_lower;
CREATE UNIQUE INDEX idx_profiles_email_lower ON public.profiles (lower(email));

-- Add case-insensitive index on team_invitations invited_email
DROP INDEX IF EXISTS public.idx_team_invitations_email_lower;
CREATE INDEX idx_team_invitations_email_lower ON public.team_invitations (lower(invited_email));

-- Replace the unique constraint on team_invitations to be case-insensitive
-- Drop old unique constraint if it exists
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'team_invitations_team_id_invited_email_status_key'
    AND conrelid = 'public.team_invitations'::regclass
  ) THEN
    ALTER TABLE public.team_invitations
      DROP CONSTRAINT team_invitations_team_id_invited_email_status_key;
  END IF;
END $$;

-- Create case-insensitive unique index instead
DROP INDEX IF EXISTS public.idx_team_invitations_unique_lower;
CREATE UNIQUE INDEX idx_team_invitations_unique_lower
  ON public.team_invitations (team_id, lower(invited_email), status);

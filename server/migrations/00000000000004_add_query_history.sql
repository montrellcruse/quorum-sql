-- Add query_history and query_approvals tables for approval workflows
-- These tables exist in the Supabase migrations but were missing from
-- the server-only migration path (used when APPLY_SUPABASE_MIGRATIONS=false).

CREATE TABLE IF NOT EXISTS public.query_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id uuid NOT NULL REFERENCES public.sql_queries(id) ON DELETE CASCADE,
  sql_content text NOT NULL,
  modified_by_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_history_query_id
  ON public.query_history(query_id);

CREATE TABLE IF NOT EXISTS public.query_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_history_id uuid NOT NULL REFERENCES public.query_history(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(query_history_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_query_approvals_query_history_id
  ON public.query_approvals(query_history_id);
CREATE INDEX IF NOT EXISTS idx_query_approvals_user_id
  ON public.query_approvals(user_id);

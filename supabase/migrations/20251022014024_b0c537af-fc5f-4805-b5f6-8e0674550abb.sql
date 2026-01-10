-- Create query_approvals table to track individual approvals
CREATE TABLE public.query_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query_history_id uuid NOT NULL REFERENCES public.query_history(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(query_history_id, user_id)
);

-- Add indexes for faster lookups
CREATE INDEX idx_query_approvals_query_history_id ON public.query_approvals(query_history_id);
CREATE INDEX idx_query_approvals_user_id ON public.query_approvals(user_id);

-- Enable RLS
ALTER TABLE public.query_approvals ENABLE ROW LEVEL SECURITY;

-- RLS policies for query_approvals
-- Users can view approvals for queries in their teams
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

-- Team members can create approvals for their team queries
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

-- Users can delete their own approvals
CREATE POLICY "Users can delete their own approvals"
  ON public.query_approvals
  FOR DELETE
  USING (user_id = auth.uid());
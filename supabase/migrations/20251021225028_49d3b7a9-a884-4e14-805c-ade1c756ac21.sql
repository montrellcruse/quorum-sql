-- Add change_reason column to query_history table
ALTER TABLE public.query_history 
ADD COLUMN change_reason text;
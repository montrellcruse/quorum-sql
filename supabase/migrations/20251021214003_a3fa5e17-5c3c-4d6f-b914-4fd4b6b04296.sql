-- Drop existing foreign key constraint
ALTER TABLE public.query_history
DROP CONSTRAINT IF EXISTS query_history_query_id_fkey;

-- Add foreign key with CASCADE delete
ALTER TABLE public.query_history
ADD CONSTRAINT query_history_query_id_fkey
FOREIGN KEY (query_id)
REFERENCES public.sql_queries(id)
ON DELETE CASCADE;
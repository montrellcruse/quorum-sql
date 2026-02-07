-- Add status column to query_history table
ALTER TABLE public.query_history
ADD COLUMN status text NOT NULL DEFAULT 'pending_approval';

-- Add check constraint to ensure only valid status values
ALTER TABLE public.query_history
ADD CONSTRAINT query_history_status_check 
CHECK (status IN ('pending_approval', 'approved', 'rejected'));

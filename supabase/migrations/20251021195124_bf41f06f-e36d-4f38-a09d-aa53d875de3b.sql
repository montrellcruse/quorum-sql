-- Add last_modified_by_email column to sql_queries table
ALTER TABLE public.sql_queries 
ADD COLUMN last_modified_by_email TEXT;
-- Add created_by_email column to projects table
ALTER TABLE public.projects 
ADD COLUMN created_by_email TEXT;

-- Add created_by_email column to sql_queries table
ALTER TABLE public.sql_queries 
ADD COLUMN created_by_email TEXT;
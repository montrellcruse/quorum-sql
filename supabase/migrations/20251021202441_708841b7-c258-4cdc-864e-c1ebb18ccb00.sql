-- Rename projects table to folders
ALTER TABLE public.projects RENAME TO folders;

-- Rename project_id column to folder_id in sql_queries table
ALTER TABLE public.sql_queries RENAME COLUMN project_id TO folder_id;

-- The foreign key constraint will automatically follow the table rename,
-- but we'll explicitly ensure it references the correct table
-- First, drop the old constraint if it exists
ALTER TABLE public.sql_queries 
DROP CONSTRAINT IF EXISTS sql_queries_project_id_fkey;

-- Add the constraint with the new naming
ALTER TABLE public.sql_queries
ADD CONSTRAINT sql_queries_folder_id_fkey 
FOREIGN KEY (folder_id) 
REFERENCES public.folders(id) 
ON DELETE CASCADE;
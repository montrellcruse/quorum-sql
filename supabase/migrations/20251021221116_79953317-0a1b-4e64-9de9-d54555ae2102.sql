-- Add parent_folder_id column to folders table to support nested folders
ALTER TABLE public.folders
ADD COLUMN parent_folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE;
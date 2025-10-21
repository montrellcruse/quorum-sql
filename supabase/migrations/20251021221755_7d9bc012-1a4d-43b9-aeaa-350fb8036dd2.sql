-- Create a function to get all folder paths with full hierarchical navigation
CREATE OR REPLACE FUNCTION public.get_all_folder_paths()
RETURNS TABLE (
  id uuid,
  full_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE folder_paths AS (
    -- Base case: root folders (no parent)
    SELECT 
      f.id,
      f.name,
      f.parent_folder_id,
      f.name AS path
    FROM folders f
    WHERE f.parent_folder_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child folders
    SELECT 
      f.id,
      f.name,
      f.parent_folder_id,
      fp.path || ' / ' || f.name AS path
    FROM folders f
    INNER JOIN folder_paths fp ON f.parent_folder_id = fp.id
  )
  SELECT 
    folder_paths.id,
    folder_paths.path AS full_path
  FROM folder_paths
  ORDER BY folder_paths.path;
$$;
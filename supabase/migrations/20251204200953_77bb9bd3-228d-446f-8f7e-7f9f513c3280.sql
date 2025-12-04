-- Create a team-specific folder paths function
CREATE OR REPLACE FUNCTION public.get_team_folder_paths(_team_id uuid)
 RETURNS TABLE(id uuid, full_path text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE folder_paths AS (
    -- Base case: root folders for this team only
    SELECT 
      f.id,
      f.name,
      f.parent_folder_id,
      f.name AS path
    FROM folders f
    WHERE f.parent_folder_id IS NULL
      AND f.team_id = _team_id
    
    UNION ALL
    
    -- Recursive case: child folders (inherently team-filtered via parent)
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
$function$;
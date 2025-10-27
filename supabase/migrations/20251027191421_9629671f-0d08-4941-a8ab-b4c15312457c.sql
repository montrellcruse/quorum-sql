-- Auto-approve queries stuck in pending_approval for single-person teams
-- This is a one-time fix for existing queries that got stuck

-- Update sql_queries status to approved for single-person teams
WITH single_person_teams AS (
  SELECT team_id, COUNT(*) as member_count
  FROM team_members
  GROUP BY team_id
  HAVING COUNT(*) = 1
)
UPDATE sql_queries sq
SET status = 'approved', updated_at = now()
FROM single_person_teams spt
WHERE sq.team_id = spt.team_id
  AND sq.status = 'pending_approval';

-- Update corresponding query_history records to approved
WITH single_person_teams AS (
  SELECT team_id
  FROM team_members
  GROUP BY team_id
  HAVING COUNT(*) = 1
),
latest_pending_history AS (
  SELECT DISTINCT ON (qh.query_id) qh.id, qh.query_id
  FROM query_history qh
  JOIN sql_queries sq ON qh.query_id = sq.id
  JOIN single_person_teams spt ON sq.team_id = spt.team_id
  WHERE qh.status = 'pending_approval'
  ORDER BY qh.query_id, qh.created_at DESC
)
UPDATE query_history qh
SET status = 'approved'
FROM latest_pending_history lph
WHERE qh.id = lph.id;
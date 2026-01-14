-- Verify all users have at least one team
SELECT
  p.email,
  COUNT(tm.team_id) as team_count,
  MAX(t.is_personal::int) as has_personal
FROM profiles p
LEFT JOIN team_members tm ON p.user_id = tm.user_id
LEFT JOIN teams t ON tm.team_id = t.id
GROUP BY p.email
HAVING COUNT(tm.team_id) = 0;

-- Should return 0 rows after successful migration

-- Verify personal teams are correctly marked
SELECT
  t.id,
  t.name,
  t.is_personal,
  COUNT(tm.id) as member_count
FROM teams t
JOIN team_members tm ON t.id = tm.team_id
WHERE t.is_personal = true
GROUP BY t.id, t.name, t.is_personal
HAVING COUNT(tm.id) > 1;

-- Should return 0 rows (personal teams should have exactly 1 member)

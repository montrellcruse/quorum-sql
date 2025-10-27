-- ============================================
-- SQL QUERY MANAGER - SEED DATA
-- ============================================
--
-- Development seed data for local testing
--
-- IMPORTANT: This file is for development only!
-- Do NOT use in production environments.
--
-- Usage:
--   - Automatically loaded with: supabase db reset
--   - Or manually: psql -f supabase/seed.sql
--
-- Note: You'll need to replace placeholder user IDs with
-- actual auth.users IDs after creating test accounts.
--
-- ============================================

-- ============================================
-- 1. CREATE TEST PROFILES
-- ============================================
-- Note: Actual auth.users are created via signup UI
-- These profiles should be created via the auth.users trigger
-- But we can insert them manually for testing if needed

-- Example placeholder UUIDs (replace with real ones)
-- Admin User:  '00000000-0000-0000-0000-000000000001'
-- Member 1:    '00000000-0000-0000-0000-000000000002'
-- Member 2:    '00000000-0000-0000-0000-000000000003'

INSERT INTO profiles (id, user_id, email, full_name, created_at, updated_at) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin@test.local',
    'Admin User',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'member@test.local',
    'Member User 1',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'member2@test.local',
    'Member User 2',
    now(),
    now()
  )
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 2. CREATE TEST TEAMS
-- ============================================

INSERT INTO teams (id, name, admin_id, approval_quota, created_at, updated_at) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'Development Team',
    '00000000-0000-0000-0000-000000000001',
    1, -- Single approval needed
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Production Team',
    '00000000-0000-0000-0000-000000000001',
    2, -- Two approvals needed
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. ADD TEAM MEMBERS
-- ============================================

-- Development Team Members
INSERT INTO team_members (id, team_id, user_id, role, created_at) VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    'member',
    now()
  )
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Production Team Members
INSERT INTO team_members (id, team_id, user_id, role, created_at) VALUES
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'member',
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    'member',
    now()
  )
ON CONFLICT (team_id, user_id) DO NOTHING;

-- ============================================
-- 4. CREATE SAMPLE FOLDERS
-- ============================================

-- Root folders
INSERT INTO folders (id, team_id, parent_folder_id, name, description, user_id, created_by_email, created_at, updated_at) VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'Analytics Queries',
    'Queries for analytics and reporting',
    '00000000-0000-0000-0000-000000000001',
    'admin@test.local',
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    NULL,
    'Data Maintenance',
    'Queries for data cleanup and maintenance',
    '00000000-0000-0000-0000-000000000001',
    'admin@test.local',
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    NULL,
    'Production Reports',
    'Production reporting queries',
    '00000000-0000-0000-0000-000000000001',
    'admin@test.local',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- Subfolders
INSERT INTO folders (id, team_id, parent_folder_id, name, description, user_id, created_by_email, created_at, updated_at) VALUES
  (
    '30000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'User Analytics',
    'User-specific analytics',
    '00000000-0000-0000-0000-000000000002',
    'member@test.local',
    now(),
    now()
  ),
  (
    '30000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Revenue Analytics',
    'Revenue and sales analytics',
    '00000000-0000-0000-0000-000000000002',
    'member@test.local',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. CREATE SAMPLE QUERIES
-- ============================================

-- Approved queries
INSERT INTO sql_queries (id, team_id, folder_id, title, description, sql_content, status, user_id, created_by_email, last_modified_by_email, created_at, updated_at) VALUES
  (
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Daily Active Users',
    'Count of daily active users',
    'SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as active_users
FROM user_events
WHERE created_at >= CURRENT_DATE - INTERVAL ''30 days''
GROUP BY DATE(created_at)
ORDER BY date DESC;',
    'approved',
    '00000000-0000-0000-0000-000000000001',
    'admin@test.local',
    'admin@test.local',
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000004',
    'User Retention Rate',
    'Calculate 7-day retention rate',
    'WITH cohorts AS (
  SELECT 
    user_id,
    DATE(MIN(created_at)) as cohort_date
  FROM user_events
  GROUP BY user_id
)
SELECT 
  c.cohort_date,
  COUNT(DISTINCT c.user_id) as cohort_size,
  COUNT(DISTINCT CASE 
    WHEN e.created_at >= c.cohort_date + INTERVAL ''7 days''
    AND e.created_at < c.cohort_date + INTERVAL ''8 days''
    THEN e.user_id 
  END) as retained_users,
  ROUND(100.0 * COUNT(DISTINCT CASE 
    WHEN e.created_at >= c.cohort_date + INTERVAL ''7 days''
    AND e.created_at < c.cohort_date + INTERVAL ''8 days''
    THEN e.user_id 
  END) / COUNT(DISTINCT c.user_id), 2) as retention_rate
FROM cohorts c
LEFT JOIN user_events e ON c.user_id = e.user_id
WHERE c.cohort_date >= CURRENT_DATE - INTERVAL ''90 days''
GROUP BY c.cohort_date
ORDER BY c.cohort_date DESC;',
    'approved',
    '00000000-0000-0000-0000-000000000002',
    'member@test.local',
    'member@test.local',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- Draft query
INSERT INTO sql_queries (id, team_id, folder_id, title, description, sql_content, status, user_id, created_by_email, last_modified_by_email, created_at, updated_at) VALUES
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    'Clean Duplicate Records',
    'Remove duplicate user records (DRAFT)',
    '-- WARNING: This query deletes data
-- Review carefully before approval
DELETE FROM users
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at) as rn
    FROM users
  ) t
  WHERE rn > 1
);',
    'draft',
    '00000000-0000-0000-0000-000000000002',
    'member@test.local',
    'member@test.local',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- Query pending approval (multi-member team)
INSERT INTO sql_queries (id, team_id, folder_id, title, description, sql_content, status, user_id, created_by_email, last_modified_by_email, created_at, updated_at) VALUES
  (
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003',
    'Monthly Revenue Report',
    'Monthly revenue breakdown by category',
    'SELECT 
  DATE_TRUNC(''month'', order_date) as month,
  category,
  SUM(amount) as revenue,
  COUNT(*) as order_count,
  AVG(amount) as avg_order_value
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL ''12 months''
GROUP BY DATE_TRUNC(''month'', order_date), category
ORDER BY month DESC, revenue DESC;',
    'pending_approval',
    '00000000-0000-0000-0000-000000000002',
    'member@test.local',
    'member@test.local',
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. CREATE QUERY HISTORY
-- ============================================

-- History for approved queries
INSERT INTO query_history (id, query_id, sql_content, modified_by_email, change_reason, status, created_at) VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as active_users
FROM user_events
WHERE created_at >= CURRENT_DATE - INTERVAL ''30 days''
GROUP BY DATE(created_at)
ORDER BY date DESC;',
    'admin@test.local',
    'Initial version',
    'approved',
    now() - INTERVAL '7 days'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    'WITH cohorts AS (
  SELECT 
    user_id,
    DATE(MIN(created_at)) as cohort_date
  FROM user_events
  GROUP BY user_id
)
SELECT 
  c.cohort_date,
  COUNT(DISTINCT c.user_id) as cohort_size,
  COUNT(DISTINCT CASE 
    WHEN e.created_at >= c.cohort_date + INTERVAL ''7 days''
    AND e.created_at < c.cohort_date + INTERVAL ''8 days''
    THEN e.user_id 
  END) as retained_users,
  ROUND(100.0 * COUNT(DISTINCT CASE 
    WHEN e.created_at >= c.cohort_date + INTERVAL ''7 days''
    AND e.created_at < c.cohort_date + INTERVAL ''8 days''
    THEN e.user_id 
  END) / COUNT(DISTINCT c.user_id), 2) as retention_rate
FROM cohorts c
LEFT JOIN user_events e ON c.user_id = e.user_id
WHERE c.cohort_date >= CURRENT_DATE - INTERVAL ''90 days''
GROUP BY c.cohort_date
ORDER BY c.cohort_date DESC;',
    'member@test.local',
    'Initial retention query',
    'approved',
    now() - INTERVAL '5 days'
  )
ON CONFLICT (id) DO NOTHING;

-- History for pending query
INSERT INTO query_history (id, query_id, sql_content, modified_by_email, change_reason, status, created_at) VALUES
  (
    '50000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000004',
    'SELECT 
  DATE_TRUNC(''month'', order_date) as month,
  category,
  SUM(amount) as revenue,
  COUNT(*) as order_count,
  AVG(amount) as avg_order_value
FROM orders
WHERE order_date >= CURRENT_DATE - INTERVAL ''12 months''
GROUP BY DATE_TRUNC(''month'', order_date), category
ORDER BY month DESC, revenue DESC;',
    'member@test.local',
    'Added average order value calculation',
    'pending_approval',
    now() - INTERVAL '1 day'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 7. CREATE SAMPLE APPROVALS
-- ============================================

-- One approval for the pending query (needs 2 total)
INSERT INTO query_approvals (id, query_history_id, user_id, created_at) VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003', -- Member 2 approved
    now() - INTERVAL '12 hours'
  )
ON CONFLICT (query_history_id, user_id) DO NOTHING;

-- ============================================
-- 8. CREATE SAMPLE INVITATION (OPTIONAL)
-- ============================================

-- Pending invitation to Development Team
INSERT INTO team_invitations (id, team_id, invited_email, role, status, invited_by_user_id, created_at, updated_at) VALUES
  (
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'newmember@test.local',
    'member',
    'pending',
    '00000000-0000-0000-0000-000000000001',
    now(),
    now()
  )
ON CONFLICT (team_id, invited_email, status) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify seed data loaded correctly:
--
-- SELECT * FROM profiles;
-- SELECT * FROM teams;
-- SELECT * FROM team_members;
-- SELECT * FROM folders;
-- SELECT * FROM sql_queries;
-- SELECT * FROM query_history;
-- SELECT * FROM query_approvals;
-- SELECT * FROM team_invitations;
--
-- ============================================

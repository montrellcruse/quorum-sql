-- Complete database and user cleanup for production
-- This deletes all test data in order of foreign key dependencies

-- 1. Delete query approvals (depends on query_history)
DELETE FROM public.query_approvals;

-- 2. Delete query history (depends on sql_queries)
DELETE FROM public.query_history;

-- 3. Delete SQL queries (depends on folders and teams)
DELETE FROM public.sql_queries;

-- 4. Delete folders (depends on teams)
DELETE FROM public.folders;

-- 5. Delete team members (depends on teams and users)
DELETE FROM public.team_members;

-- 6. Delete team invitations (depends on teams)
DELETE FROM public.team_invitations;

-- 7. Delete teams (depends on users for admin_id)
DELETE FROM public.teams;

-- 8. Delete profiles (depends on auth.users)
DELETE FROM public.profiles;

-- 9. Delete all auth users (CASCADE will handle remaining dependencies)
DELETE FROM auth.users;
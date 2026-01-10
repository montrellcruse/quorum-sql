# Database Setup Guide

This directory contains the database schema, migrations, and configuration for the SQL Query Manager application.

## Overview

The application uses Supabase (PostgreSQL) with Row-Level Security (RLS) for secure, team-based data access.

## Quick Start

### Self-Hosting

#### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- [Node.js](https://nodejs.org/) v18+ installed
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed

```bash
# Install Supabase CLI globally
npm install -g supabase
```

#### Initial Setup

```bash
# 1. Start local Supabase (requires Docker)
supabase start

# This will:
# - Start PostgreSQL, Auth, Storage, and Realtime services
# - Apply all migrations from supabase/migrations/
# - Create the initial schema
# - Load seed data (if available)

# 2. Note the API URL and anon key from output
# Add these to your .env file:
# VITE_SUPABASE_URL=http://localhost:54321
# VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key-from-output>

# 3. Access local dashboard
# Dashboard: http://localhost:54323
# Database: postgresql://postgres:postgres@localhost:54322/postgres
```

#### Reset Database

```bash
# Reset to clean state (reapplies all migrations + seed data)
supabase db reset
```

#### Stop Services

```bash
# Stop all Supabase services
supabase stop
```

## Production Deployment

### Using Supabase Cloud

1. **Create a Supabase Project**:
   - Go to [https://supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Link Project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Push Migrations**:
   ```bash
   supabase db push
   ```

4. **Configure Environment**:
   - Update `.env` with your Supabase URL and keys
   - Configure `VITE_ALLOWED_EMAIL_DOMAIN`

5. **Setup Auth**:
   - In Supabase dashboard, go to Authentication > Settings
   - Configure Site URL to your production domain
   - Add redirect URLs for your domain
   - Enable Email provider
   - (Optional) Enable Google OAuth

## Database Schema

### Core Tables

#### 1. **profiles**
User profile information synced with auth.users.

```sql
profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### 2. **teams**
Team management with configurable approval quotas.

```sql
teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id UUID NOT NULL,
  approval_quota INTEGER DEFAULT 1,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### 3. **team_members**
User-team relationships with role-based access.

```sql
team_members (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMP
)
```

#### 4. **team_invitations**
Pending team invitations.

```sql
team_invitations (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL,
  invited_email TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'member')),
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_by_user_id UUID,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### 5. **folders**
Hierarchical organization of queries.

```sql
folders (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL,
  parent_folder_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID NOT NULL,
  created_by_email TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### 6. **sql_queries**
Versioned SQL query storage.

```sql
sql_queries (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL,
  folder_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sql_content TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'pending_approval', 'approved')),
  user_id UUID NOT NULL,
  created_by_email TEXT,
  last_modified_by_email TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

#### 7. **query_history**
Complete change history for queries.

```sql
query_history (
  id UUID PRIMARY KEY,
  query_id UUID NOT NULL,
  sql_content TEXT NOT NULL,
  modified_by_email TEXT NOT NULL,
  change_reason TEXT,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMP
)
```

#### 8. **query_approvals**
Approval tracking for peer review.

```sql
query_approvals (
  id UUID PRIMARY KEY,
  query_history_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP
)
```

### Entity Relationships

See `ERD.md` for a visual diagram of table relationships.

## Row-Level Security (RLS)

All tables have RLS enabled with 37+ policies enforcing:

- **Team Isolation**: Users can only access their teams' data
- **Role-Based Access**: Admins have additional privileges
- **Owner Protection**: Query/folder owners have special rights
- **Peer Review**: Self-approval prevention

### Key RLS Helper Functions

```sql
-- Returns teams a user belongs to
user_teams(user_id UUID) RETURNS SETOF UUID

-- Returns teams where user is admin
user_admin_teams(user_id UUID) RETURNS SETOF UUID

-- Checks if user can access team
user_can_access_team(user_id UUID, team_id UUID) RETURNS BOOLEAN

-- Checks if user is team admin
user_is_team_admin(user_id UUID, team_id UUID) RETURNS BOOLEAN
```

All functions use:
- `SECURITY DEFINER` for controlled privilege elevation
- `SET search_path = public` to prevent search path attacks

## Migrations

### Migration Files

Location: `supabase/migrations/`

Format: `YYYYMMDDHHMMSS_<uuid>.sql`

Migrations are applied sequentially by timestamp.

### Current Migrations (46 total)

Key migrations include:
- Initial schema creation
- RLS policy setup
- Security definer functions
- Approval workflow functions
- Race condition fixes

### Creating New Migrations

```bash
# Create a new migration
supabase migration new description_of_change

# This creates: supabase/migrations/YYYYMMDDHHMMSS_description_of_change.sql
```

**Important Guidelines**:
- Never modify existing migrations
- Test migrations locally before pushing
- Include both UP and DOWN logic where possible
- Document complex changes in comments

## Seed Data

File: `supabase/seed.sql`

Contains development data for testing:
- Sample teams
- Sample folders
- Sample queries
- Test approval workflows

**Important**: Seed data uses placeholder UUIDs. Update with real user IDs after authentication.

## Security

### Security Checklist

- [x] RLS enabled on all tables
- [x] Security definer functions use `SET search_path`
- [x] Check constraints on enum fields (role, status)
- [x] No recursive RLS issues
- [x] Foreign keys properly defined
- [x] Indexes on frequently queried columns

### Linting

```bash
# Run security linter
supabase db lint

# This checks for:
# - Tables without RLS
# - Overly permissive policies
# - Security definer issues
# - Missing indexes
```

**Note**: Linting catches obvious issues but doesn't replace manual security review.

## Common Tasks

### View Current Schema

```bash
# Generate schema SQL
supabase db dump --schema public --schema auth --schema storage
```

### Reset Specific Table

```sql
-- In psql or Supabase SQL editor
TRUNCATE table_name CASCADE;
```

### Check RLS Policies

```sql
-- List all policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### View Active Connections

```sql
SELECT * FROM pg_stat_activity WHERE datname = 'postgres';
```

## Troubleshooting

### Migrations Won't Apply

```bash
# Check migration status
supabase migration list

# Reset and reapply
supabase db reset
```

### RLS Blocking Queries

1. Check if you're authenticated: `SELECT auth.uid();`
2. Verify user is member of team they're accessing
3. Check RLS policies for specific table
4. Review security definer function logic

### Can't Access Data

Common causes:
1. Not authenticated (auth.uid() is NULL)
2. Not a member of the team
3. Missing RLS policy for specific operation
4. Security definer function logic issue

## Documentation Files

- **schema.sql**: Complete schema documentation
- **seed.sql**: Development seed data
- **ERD.md**: Entity relationship diagram
- **README.md**: This file

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Project Security Policy](../SECURITY.md)

## Support

For issues or questions:
1. Check existing GitHub issues
2. Review Supabase documentation
3. Check project SECURITY.md for security concerns
4. Open a new issue with reproduction steps

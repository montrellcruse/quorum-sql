# Entity Relationship Diagram

This document provides a visual representation of the Quorum database schema.

## Database Schema Diagram

```mermaid
erDiagram
    profiles ||--o{ team_members : "user_id"
    profiles ||--o{ team_invitations : "invited by"
    profiles ||--o{ folders : "creates"
    profiles ||--o{ sql_queries : "creates"
    profiles ||--o{ query_approvals : "approves"
    
    teams ||--o{ team_members : "has members"
    teams ||--o{ team_invitations : "has invitations"
    teams ||--o{ folders : "contains"
    teams ||--o{ sql_queries : "contains"
    teams ||--|| profiles : "admin_id"
    
    folders ||--o{ sql_queries : "organizes"
    folders ||--o{ folders : "parent_folder_id"
    
    sql_queries ||--o{ query_history : "tracks changes"
    
    query_history ||--o{ query_approvals : "receives approvals"

    profiles {
        uuid id PK
        uuid user_id UK
        text email "NOT NULL"
        text full_name
        timestamp created_at
        timestamp updated_at
    }

    teams {
        uuid id PK
        text name "NOT NULL"
        uuid admin_id FK "Team owner"
        int approval_quota "Default 1"
        boolean is_personal "Default false"
        timestamp created_at
        timestamp updated_at
    }

    team_members {
        uuid id PK
        uuid team_id FK
        uuid user_id FK
        app_role role "admin | member"
        timestamp created_at
    }

    team_invitations {
        uuid id PK
        uuid team_id FK
        text invited_email "NOT NULL"
        app_role role "admin | member"
        text status "pending | accepted | revoked"
        uuid invited_by_user_id FK
        timestamp created_at
        timestamp updated_at
    }

    folders {
        uuid id PK
        uuid team_id FK
        uuid parent_folder_id FK "Nullable for root"
        text name "NOT NULL"
        text description
        uuid user_id FK
        text created_by_email
        timestamp created_at
        timestamp updated_at
    }

    sql_queries {
        uuid id PK
        uuid team_id FK
        uuid folder_id FK
        text title "NOT NULL"
        text description
        text sql_content "NOT NULL, max 100KB"
        text status "draft | pending_approval | approved"
        uuid user_id FK
        text created_by_email
        text last_modified_by_email
        timestamp created_at
        timestamp updated_at
    }

    query_history {
        uuid id PK
        uuid query_id FK
        text sql_content "NOT NULL"
        text modified_by_email "NOT NULL"
        text change_reason
        text status "approved | pending_approval | rejected"
        timestamp created_at
    }

    query_approvals {
        uuid id PK
        uuid query_history_id FK
        uuid user_id FK
        timestamp created_at
    }
```

## Table Relationships Explained

### Core Relationships

1. **profiles → team_members → teams**
   - Users (profiles) belong to multiple teams via team_members
   - Each team membership has a role (admin or member)
   - One-to-many from profiles to team_members
   - Many-to-one from team_members to teams

2. **teams → folders → sql_queries**
   - Teams contain folders (organizational structure)
   - Folders contain SQL queries
   - Folders can be nested (parent_folder_id self-reference)
   - All data is team-scoped for isolation

3. **sql_queries → query_history → query_approvals**
   - Each query modification creates a history record
   - History records track approval status
   - Multiple users can approve each history record
   - Peer review enforced at database level

4. **team_invitations**
   - Standalone invitation tracking
   - Links team_id to invited_email
   - Converts to team_members when accepted

### Key Constraints

- **Unique Constraints**:
  - `profiles.user_id` (one profile per auth user)
  - `team_members(team_id, user_id)` (one role per user per team)
  - `query_approvals(query_history_id, user_id)` (one approval per user per version)

- **Check Constraints**:
  - `team_members.role` uses `app_role` enum ('admin', 'member')
  - `team_invitations.role` uses `app_role` enum ('admin', 'member')
  - `team_invitations.status IN ('pending', 'accepted', 'revoked')`
  - `query_history.status IN ('pending_approval', 'approved', 'rejected')`
  - `sql_queries.sql_content` max 100KB via CHECK constraint

- **Foreign Keys**:
  - All relationships use UUID foreign keys
  - ON DELETE CASCADE on most foreign keys (team deletion cascades to members, folders, queries)
  - `team_invitations.invited_by_user_id` uses ON DELETE SET NULL

## Data Flow Examples

### Creating a Query

```
User creates query
    ↓
sql_queries (status: 'draft')
    ↓
User submits for approval
    ↓
query_history created (status: 'pending_approval')
    ↓
sql_queries.status = 'pending_approval'
    ↓
Team members approve
    ↓
query_approvals created (one per approver)
    ↓
When approval_quota met
    ↓
sql_queries.status = 'approved'
    ↓
query_history.status = 'approved'
```

### Team Invitation Flow

```
Admin invites user
    ↓
team_invitations created (status: 'pending')
    ↓
User receives invitation
    ↓
User accepts
    ↓
team_members created
    ↓
team_invitations.status = 'accepted'
```

### Folder Hierarchy

```
Root Folder (parent_folder_id: NULL)
    ├─ Subfolder 1 (parent_folder_id: Root)
    │   ├─ Query 1
    │   └─ Query 2
    └─ Subfolder 2 (parent_folder_id: Root)
        └─ Query 3
```

## Security Model

### Row-Level Security (RLS)

All tables have RLS policies enforcing:

1. **Team Isolation**: Users can only access data for their teams
2. **Role-Based Access**: Admins have additional privileges
3. **Owner Rights**: Creators have special permissions
4. **Peer Review**: Self-approval prevented

### Security Definer Functions

Helper functions used by RLS policies:
- `user_teams()` - Returns user's team IDs
- `user_admin_teams()` - Returns teams where user is admin
- `user_can_access_team()` - Verifies team access
- `user_is_team_admin()` - Verifies admin status

All functions use:
- `SECURITY DEFINER` for controlled privilege elevation
- `SET search_path = public` to prevent search path attacks

## Indexes

Performance indexes on frequently queried columns:

- `idx_profiles_user_id` on `profiles(user_id)`
- `idx_profiles_email` on `profiles(email)`
- `idx_teams_admin` on `teams(admin_id)`
- `idx_team_members_user_id` on `team_members(user_id)`
- `idx_team_members_team_id` on `team_members(team_id)`
- `idx_folders_team_id` on `folders(team_id)`
- `idx_folders_parent` on `folders(parent_folder_id)`
- `idx_sql_queries_team_id` on `sql_queries(team_id)`
- `idx_sql_queries_folder_id` on `sql_queries(folder_id)`
- `idx_query_history_query_id` on `query_history(query_id)`
- `idx_query_approvals_history_id` on `query_approvals(query_history_id)`
- `idx_team_invitations_email` on `team_invitations(invited_email)`
- `idx_team_invitations_team` on `team_invitations(team_id)`

## Additional Resources

- **Schema Documentation**: See `schema.sql` for complete SQL definitions
- **Seed Data**: See `seed.sql` for development test data
- **Database Guide**: See `README.md` for setup instructions
- **Security Policy**: See `../SECURITY.md` for security details

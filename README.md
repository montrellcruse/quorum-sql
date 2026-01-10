# SQL Query Manager

A secure, team-based SQL query management application with version control and peer review workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Quick Start (5 minutes)

### Option 1: Guided Setup (Recommended)

```bash
git clone https://github.com/montrellcruse/daas-bi-sql-hub.git
cd daas-bi-sql-hub
npm install
npm run dev
```

Then visit **http://localhost:8080/setup** to configure your instance through the guided wizard.

### Option 2: Docker (Self-Hosted)

```bash
git clone https://github.com/montrellcruse/daas-bi-sql-hub.git
cd daas-bi-sql-hub
docker compose up -d
```

The application will be available at **http://localhost:8080**

## Features

- **Team Collaboration** - Multi-tenant architecture with team isolation
- **Version Control** - Complete change history with rollback capability
- **Approval Workflows** - Configurable approval quotas for query changes
- **Peer Review** - Built-in approval system prevents self-approval
- **Role-Based Access** - Admin and member roles with granular permissions
- **Self-Hosted** - Run on your own infrastructure with full control
- **Secure by Default** - Row-Level Security (RLS) on all database tables

## Deployment Options

| Mode | Best For | Auth | Database |
|------|----------|------|----------|
| **Self-Hosted** | Full control, air-gapped environments | Local accounts | PostgreSQL via Docker |
| **Supabase Cloud** | Quick start, managed infrastructure | Supabase Auth + Google OAuth | Supabase PostgreSQL |

## Configuration

### Using the Setup Wizard

The setup wizard at `/setup` will guide you through:

1. **Choose Database** - Self-Hosted or Supabase Cloud
2. **Configure Settings** - Email domain, app name
3. **Generate Config** - Download your `.env` file

### Manual Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database Provider: 'rest' (self-hosted) or 'supabase' (cloud)
VITE_DB_PROVIDER=rest

# Self-Hosted Mode
VITE_API_BASE_URL=http://localhost:8787
VITE_AUTH_PROVIDERS=local

# OR Supabase Mode
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

# Common Settings
VITE_ALLOWED_EMAIL_DOMAIN=@yourcompany.com
VITE_APP_NAME=SQL Query Manager
```

## Self-Hosted Setup

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) installed
- [Node.js](https://nodejs.org/) v18+ (for development)

### Steps

1. **Start the database and API server**:
   ```bash
   docker compose up -d db adminer server
   ```

2. **Configure the frontend**:
   ```bash
   cp .env.example .env
   # Edit .env: set VITE_DB_PROVIDER=rest
   ```

3. **Start the application**:
   ```bash
   npm install
   npm run dev
   ```

4. **Access the app**: http://localhost:8080

5. **Database admin** (optional): http://localhost:8080 (Adminer)
   - System: PostgreSQL
   - Server: db
   - User: postgres
   - Password: postgres

## Supabase Cloud Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Install Supabase CLI and push migrations**:
   ```bash
   npm install -g supabase
   supabase link --project-ref your-project-ref
   supabase db push
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Enable Google OAuth** (optional):
   - Configure in Supabase Dashboard → Authentication → Providers
   - Add OAuth credentials from Google Cloud Console

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   React App     │────▶│  REST API Server │
│  (Vite + TS)    │     │    (Fastify)     │
└─────────────────┘     └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │   PostgreSQL     │
                        │  (Docker/Cloud)  │
                        └──────────────────┘
```

### Database Schema

8 tables with Row-Level Security:

| Table | Purpose |
|-------|---------|
| `profiles` | User information |
| `teams` | Team management + approval quotas |
| `team_members` | User-team relationships |
| `team_invitations` | Pending invitations |
| `folders` | Query organization |
| `sql_queries` | Versioned query storage |
| `query_history` | Change tracking |
| `query_approvals` | Approval workflow |

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Security

- **37+ RLS Policies** - Database-level access control
- **Team Isolation** - Users only see their teams' data
- **Peer Review** - Self-approval prevented at database level
- **Domain Restriction** - Configurable email authentication
- **SQL Injection Protection** - Parameterized queries
- **XSS Protection** - React's automatic escaping

See [SECURITY.md](SECURITY.md) for details.

## Project Structure

```
├── src/
│   ├── components/     # React components
│   │   ├── setup/      # Setup wizard
│   │   └── ui/         # UI components
│   ├── contexts/       # Auth & Team contexts
│   ├── pages/          # Page components
│   └── integrations/   # Supabase client
├── server/             # REST API server
├── supabase/
│   ├── migrations/     # Database migrations
│   └── schema.sql      # Schema documentation
├── docker-compose.yml  # Docker configuration
└── .env.example        # Environment template
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Run tests locally
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/montrellcruse/daas-bi-sql-hub/issues)
- **Docs**: Check `supabase/README.md` for database details
- **Security**: See [SECURITY.md](SECURITY.md)

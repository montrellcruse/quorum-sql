# SQL Query Manager

A secure, team-based SQL query management application with version control and peer review workflows.

## 🚀 Features

- **Team-Based Organization**: Multi-tenant architecture with team isolation
- **Role-Based Access Control**: Admin and member roles with granular permissions
- **Approval Workflows**: Configurable approval quotas for query changes
- **Version Control**: Complete change history with rollback capability
- **Peer Review**: Built-in approval system prevents self-approval
- **Hierarchical Folders**: Organize queries in nested folder structures
- **Domain Restriction**: Configurable email domain authentication
- **Secure by Default**: Row-Level Security (RLS) on all database tables

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Authentication Setup](#authentication-setup)
- [Database Schema](#database-schema)
- [Development](#development)
- [Deployment](#deployment)
- [Security](#security)
- [License](#license)

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- [Supabase account](https://supabase.com) (for backend)
- [Docker](https://www.docker.com/) (optional, for local Supabase)

### Quick Start

1. **Clone the repository**

```bash
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

Required environment variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key
- `VITE_SUPABASE_PROJECT_ID` - Your Supabase project ID
- `VITE_ALLOWED_EMAIL_DOMAIN` - Email domain for authentication (e.g., `@yourcompany.com`)

Optional variables:
- `VITE_GOOGLE_WORKSPACE_DOMAIN` - Google Workspace domain for OAuth hint
- `VITE_APP_NAME` - Custom application name (default: "SQL Query Manager")
- `VITE_APP_DESCRIPTION` - Custom description

4. **Setup database**

See [Database Setup](#database-setup) section below.

5. **Start development server**

```bash
npm run dev
```

The application will be available at `http://localhost:8080`.

## ⚙️ Configuration

### Email Domain Restriction

Set the allowed email domain for authentication:

```bash
VITE_ALLOWED_EMAIL_DOMAIN=@yourcompany.com
```

This restricts authentication to users with emails from the specified domain. Users with emails from other domains will be denied access.

**Development Mode**: The application includes test accounts (`admin@test.local`, `member@test.local`) that bypass domain validation in development mode only.

### Google OAuth Configuration

To enable Google OAuth:

1. **Create OAuth credentials** in [Google Cloud Console](https://console.cloud.google.com):
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Add your application URL to authorized JavaScript origins
   - Add callback URL to authorized redirect URIs

2. **Configure in Supabase**:
   - Go to Authentication > Providers in Supabase dashboard
   - Enable Google provider
   - Add your Client ID and Client Secret

3. **Optional: Set Google Workspace domain hint**:
   ```bash
   VITE_GOOGLE_WORKSPACE_DOMAIN=yourcompany.com
   ```

### Approval Quotas

Team admins can configure approval quotas per team:
- **1 approval**: Single-member teams or low-risk queries
- **2+ approvals**: Multi-member teams or high-risk queries

Set via Team Admin interface after creating a team.

## 🔐 Authentication Setup

### Supabase Auth Configuration

1. **Enable Email Provider**:
   - In Supabase dashboard: Authentication > Providers
   - Enable "Email" provider
   - Configure email templates (optional)

2. **Configure Site URL**:
   - In Supabase dashboard: Authentication > Settings
   - Set Site URL to your application URL (e.g., `https://yourdomain.com`)

3. **Add Redirect URLs**:
   - Add all deployment URLs (staging, production)
   - Include `http://localhost:8080/auth` for local development

4. **Optional: Disable Email Confirmation** (for testing):
   - In Supabase dashboard: Authentication > Settings
   - Disable "Enable email confirmations"
   - ⚠️ Enable this in production!

### Google OAuth Setup

See [Google OAuth Configuration](#google-oauth-configuration) above.

## 🗄️ Database Setup

### Using Supabase Cloud

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Push migrations**:
   ```bash
   supabase db push
   ```

5. **Update .env** with your Supabase credentials

### Using Local Supabase (Development)

1. **Install Docker Desktop**

2. **Start local Supabase**:
   ```bash
   supabase start
   ```

   This will:
   - Start PostgreSQL, Auth, Storage, and Realtime
   - Apply all migrations from `supabase/migrations/`
   - Load seed data (if available)

3. **Access local dashboard**: `http://localhost:54323`

4. **Database connection**: `postgresql://postgres:postgres@localhost:54322/postgres`

5. **Update .env** with local credentials:
   ```bash
   VITE_SUPABASE_URL=http://localhost:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key-from-output>
   ```

### Using Generic PostgreSQL (No Supabase)

This mode runs a generic Postgres database with a lightweight backend API. It emulates `auth.uid()`/`auth.role()` so existing RLS works.

1. Start services with Docker Compose:

```bash
docker compose up -d db adminer server
```

2. Configure frontend env:

```bash
cp .env.example .env
echo "VITE_DB_PROVIDER=rest" >> .env
echo "VITE_API_BASE_URL=http://localhost:8787" >> .env
```

3. Run the app:

```bash
npm run dev
```

Adminer is available at http://localhost:8080 (System: PostgreSQL, Server: db, User: postgres, Password: postgres, Database: appdb).

### Dual Auth (Supabase + Local)

You can enable both auth providers and let users choose:

```bash
# Frontend
VITE_DB_PROVIDER=rest
VITE_AUTH_PROVIDERS=supabase,local
VITE_API_BASE_URL=http://localhost:8787
VITE_SUPABASE_URL=...    # if you also want Supabase sign-in
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

In this mode, the backend accepts either a local session or a Supabase JWT (verification to be configured via environment on the server).

### Database Schema

The application uses 8 tables with Row-Level Security:

1. **profiles** - User profile information
2. **teams** - Team management with approval quotas
3. **team_members** - User-team relationships with roles
4. **team_invitations** - Pending team invitations
5. **folders** - Hierarchical query organization
6. **sql_queries** - Versioned SQL query storage
7. **query_history** - Complete change history
8. **query_approvals** - Approval tracking for peer review

For detailed schema documentation, see:
- [`supabase/schema.sql`](supabase/schema.sql) - Complete schema with comments
- [`supabase/ERD.md`](supabase/ERD.md) - Entity Relationship Diagram
- [`supabase/README.md`](supabase/README.md) - Database setup guide

## 🛠️ Development

### Project Structure

```
.
├── src/
│   ├── components/      # React components
│   │   └── ui/          # shadcn/ui components
│   ├── contexts/        # React contexts (Auth, Team)
│   ├── hooks/           # Custom React hooks
│   ├── integrations/    # External integrations (Supabase)
│   ├── pages/           # Page components
│   ├── utils/           # Utility functions
│   └── main.tsx         # Application entry point
├── supabase/
│   ├── migrations/      # Database migrations (43 files)
│   ├── schema.sql       # Schema documentation
│   ├── seed.sql         # Development seed data
│   ├── ERD.md           # Entity Relationship Diagram
│   └── README.md        # Database setup guide
├── .env.example         # Environment variable template
├── SECURITY.md          # Security documentation
├── LICENSE              # MIT License
└── README.md            # This file
```

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run type-check

# Lint code
npm run lint
```

### Database Commands

```bash
# Reset local database (reapply migrations + seed)
supabase db reset

# Create new migration
supabase migration new description_of_change

# Run linter (security checks)
supabase db lint

# Dump current schema
supabase db dump
```

## 🚀 Deployment

### Deploy to Vercel/Netlify/etc.

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your hosting provider

3. **Configure environment variables** on your hosting platform

4. **Update Supabase redirect URLs** with your deployment URL

### Deploy Database Migrations

```bash
# Push migrations to Supabase Cloud
supabase db push

# Or deploy via Supabase dashboard SQL editor
```

## 🔒 Security

This application implements enterprise-grade security:

- **Row-Level Security (RLS)**: All tables protected with 37+ policies
- **Team Isolation**: Users can only access their teams' data
- **Role-Based Access**: Admin and member roles with distinct privileges
- **Peer Review Enforcement**: Self-approval prevented at database level
- **Domain Restriction**: Configurable email domain authentication
- **Atomic Operations**: Race condition prevention via database locking
- **SQL Injection Protection**: Parameterized queries throughout
- **XSS Protection**: React JSX automatic escaping

For detailed security information, see:
- [`SECURITY.md`](SECURITY.md) - Security features and best practices
- [`supabase/README.md`](supabase/README.md#security) - Database security details

### Security Checklist

Before deploying to production:

- [ ] Set `VITE_ALLOWED_EMAIL_DOMAIN` for your organization
- [ ] Enable email confirmation in Supabase Auth settings
- [ ] Configure proper redirect URLs in Supabase
- [ ] Run `supabase db lint` to check for security issues
- [ ] Verify RLS policies are enabled on all tables
- [ ] Remove or disable development test accounts
- [ ] Set `NODE_ENV=production` in environment
- [ ] Configure approval quotas per team requirements

## 🧪 Testing

### Development Test Accounts

In development mode, the following test accounts bypass domain validation:
- `admin@test.local` (admin role)
- `member@test.local` (member role)

These are automatically disabled in production (`NODE_ENV=production`).

### Seed Data

Load development seed data:

```bash
supabase db reset  # Includes seed.sql
```

Or manually:
```bash
psql -f supabase/seed.sql
```

## 📚 Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Email + Google OAuth)
- **State Management**: React Context
- **Data Fetching**: TanStack Query (React Query)
- **Code Editor**: Monaco Editor (for SQL)
- **Routing**: React Router v6

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. Follow existing code style
2. Write meaningful commit messages
3. Test changes locally with `supabase db reset`
4. Run `supabase db lint` before submitting
5. Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check `supabase/README.md` for database questions
- **Security**: See `SECURITY.md` for security concerns
- **Issues**: Open an issue on GitHub with reproduction steps

## 🙏 Acknowledgments

- Built with [Lovable](https://lovable.dev)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Backend powered by [Supabase](https://supabase.com)

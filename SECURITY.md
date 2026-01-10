# Security Policy

## Overview

SQL Query Manager is built with security as a core principle. This document outlines the security features, practices, and how to report vulnerabilities.

## Security Features

### Authentication & Authorization

- **Email Domain Restriction**: Configurable domain-based access control (e.g., only @yourcompany.com emails)
- **OAuth Integration**: Google OAuth support with optional Google Workspace domain hints
- **Session Management**: Secure JWT token handling via Supabase Auth
- **Domain Validation**: Enforced at both authentication and team invitation levels

### Database Security

- **Row-Level Security (RLS)**: All 8 database tables protected with 37+ RLS policies
- **Team-Based Access Control**: Users can only access data for teams they belong to
- **Role-Based Permissions**: Admin and member roles with distinct capabilities
- **Security Definer Functions**: Helper functions with `SET search_path` to prevent attacks

### Query Approval Workflow

- **Peer Review Enforcement**: Users cannot approve or reject their own changes
- **Approval Quotas**: Configurable number of approvals required per team
- **Atomic Operations**: Race condition prevention through database-level locking
- **Complete Audit Trail**: All changes tracked in query_history table

### Input Validation

- **Parameterized Queries**: All database operations use Supabase client (prevents SQL injection)
- **Email Validation**: Format and domain validation for all email inputs
- **SQL Content Limits**: 100KB maximum query size
- **XSS Protection**: React JSX automatic escaping for all dynamic content

### Data Protection

- **No Sensitive Logging**: Passwords, tokens, and sensitive data never logged to console
- **Secure Storage**: Authentication tokens managed by Supabase
- **Team Isolation**: Strict RLS policies prevent cross-team data access
- **Email Tracking**: All modifications tracked with user email for accountability

## Architecture Security

### Defense-in-Depth

1. **Client-Side Validation** (UX): UI shows/hides based on permissions
2. **Database Constraints** (Type Safety): CHECK constraints prevent invalid data
3. **RLS Policies** (Authorization): Server-side access control
4. **Security Definer Functions** (Privilege Management): Controlled permission elevation

### Database Functions

All security-critical operations use database functions with proper security:

- `user_teams(user_id)` - Returns teams a user belongs to
- `user_admin_teams(user_id)` - Returns teams where user is admin
- `user_can_access_team(user_id, team_id)` - Verifies team access
- `user_is_team_admin(user_id, team_id)` - Verifies admin status
- `submit_query_for_approval()` - Atomic submission with race condition prevention
- `approve_query_with_quota()` - Enforces peer review and approval quotas
- `reject_query_with_authorization()` - Enforces peer review for rejections

All functions use:
- `SECURITY DEFINER` with proper privilege handling
- `SET search_path = public` to prevent search path attacks

## Known Limitations

### Development Mode

- **Test Accounts**: Development mode includes test accounts (`admin@test.local`, `member@test.local`) that bypass domain validation
- **Auto-Confirm Email**: Email confirmation may be disabled in development for faster testing
- **Important**: Ensure `NODE_ENV=production` in production deployments

### Email Domain Configuration

- Domain restrictions require proper configuration via `VITE_ALLOWED_EMAIL_DOMAIN`
- Without configuration, defaults to `@example.com` (no access in production)
- Google Workspace domain hints are optional and don't enforce authentication

### RLS Policies

- RLS policies protect data access but don't prevent logical application bugs
- Policies should be reviewed when adding new features or tables
- Use `supabase db lint` to check for common RLS misconfigurations

## Security Best Practices for Deployers

### Required Configuration

1. **Set Email Domain**: Configure `VITE_ALLOWED_EMAIL_DOMAIN` for your organization
2. **Supabase Setup**: Create a new Supabase project with RLS enabled
3. **Environment Variables**: Use `.env.example` as template, never commit `.env`
4. **Google OAuth**: Configure OAuth credentials with proper redirect URLs

### Production Checklist

- [ ] Email domain configured correctly
- [ ] Auto-confirm email disabled (unless using magic links)
- [ ] Google OAuth credentials configured
- [ ] Redirect URLs properly set in Supabase
- [ ] RLS enabled on all tables (verify with `supabase db lint`)
- [ ] Test accounts disabled (`NODE_ENV=production`)
- [ ] `.env` file excluded from version control
- [ ] Approval quotas configured per team requirements

### Supabase Configuration

1. **Auth Settings**:
   - Enable Email provider
   - Enable Google OAuth (if needed)
   - Configure Site URL to your domain
   - Add redirect URLs for all deployment environments

2. **Database**:
   - Run all migrations in `supabase/migrations/`
   - Verify RLS policies with `supabase db lint`
   - Review `supabase/schema.sql` for table structure

3. **API Keys**:
   - Use `anon` key for client-side (already public)
   - Protect `service_role` key (never expose to client)

## Reporting Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. **Use GitHub Security Advisories**: Report via the repository's Security tab
3. **Or Email**: Contact the maintainers directly
4. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Assessment**: Initial assessment within 5 business days
- **Resolution**: Timeline depends on severity (critical issues prioritized)
- **Credit**: Security researchers credited (if desired)

## Security Updates

### Staying Updated

- **Dependencies**: Regularly update npm packages with `npm audit`
- **Supabase**: Monitor Supabase changelog for security updates
- **React**: Keep React and related libraries updated
- **Migrations**: Review new migrations for security implications

### Security Advisories

Monitor these sources for security updates:
- Supabase Security Advisories
- React Security Updates
- npm Security Advisories (`npm audit`)
- This repository's security advisories (if public)

## Compliance Considerations

### Data Privacy

- **User Data**: Email addresses and profile information stored
- **Query Content**: SQL queries stored in database (may contain sensitive data)
- **Audit Trail**: All changes tracked with user email
- **Data Retention**: No automatic deletion (implement as needed)

### GDPR/Privacy Requirements

If deploying in regulated environments:
- Implement data retention policies
- Add user data export functionality
- Add user account deletion functionality
- Update privacy policy accordingly

## Security Audit History

- **2025-10-27**: Comprehensive security review conducted
  - Race condition in auto-approval fixed
  - Email domain validation added
  - Role management verified secure
  - **Result**: Zero high/medium/low severity vulnerabilities

## Additional Resources

- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://react.dev/learn/thinking-in-react#where-to-put-security)

## License

This security policy is part of the SQL Query Manager project and follows the same MIT License.

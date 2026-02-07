# Contributing to Quorum

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/quorum-sql.git
   cd quorum-sql
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Start development server**:
   ```bash
   pnpm dev
   ```

## Development Setup

### Running the Full Stack

```bash
# Start database and API server
docker compose up -d db server

# Start frontend
pnpm dev
```

### Database Migrations

When making database changes:

```bash
# Create a new migration
supabase migration new description_of_change

# Apply migrations locally
supabase db reset

# Lint for security issues
supabase db lint
```

## Submitting Changes

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards below

3. **Test your changes**:
   ```bash
   pnpm build
   pnpm lint
   ```

4. **Commit with a clear message**:
   ```bash
   git commit -m "Add feature: description of what you added"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** against `main`

### Commit Message Format

Use clear, descriptive commit messages:

```
Add feature: user profile editing
Fix: team invitation email validation
Update: improve query editor performance
Docs: add API documentation
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Prefer interfaces over types for object shapes
- Use explicit return types for functions

### React

- Use functional components with hooks
- Keep components focused and small
- Use the existing UI components from `src/components/ui/`
- Follow the existing folder structure

### CSS/Styling

- Use Tailwind CSS classes
- Follow the existing color scheme and spacing
- Ensure responsive design (mobile-first)

### Database

- All tables must have Row-Level Security (RLS) enabled
- Create migrations for schema changes
- Document new tables/columns in schema.sql
- Run `supabase db lint` before submitting

## What to Contribute

### Good First Issues

Look for issues labeled `good first issue` - these are great for newcomers.

### Feature Ideas

- UI/UX improvements
- Performance optimizations
- Additional authentication providers
- Query syntax highlighting improvements
- Export/import functionality

### Bug Reports

When reporting bugs, include:

1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser/OS information
5. Console errors (if any)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on the code, not the person

## Questions?

- Open a [GitHub Issue](https://github.com/montrellcruse/quorum-sql/issues)
- Check existing issues before creating new ones

Thank you for contributing!

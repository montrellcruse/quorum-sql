# Skill: quorum-sql

## Purpose
Quick guidance for common Quorum SQL tasks (frontend, backend, database).

## Commands
- Frontend dev: `npm run dev`
- Backend dev: `cd server && npm run dev`
- Local services: `docker-compose up`
- Migrations: `npm --prefix server run migrate:seed`

## Code Map
- Frontend pages: `src/pages/`
- Shared UI: `src/components/`
- Backend routes: `server/src/index.ts`
- DB schema: `supabase/schema.sql`

## Tips
- Keep `docs/api/openapi.yml` updated when backend routes change.
- Add new feature flags to `src/lib/featureFlags.ts` and `.env.example`.

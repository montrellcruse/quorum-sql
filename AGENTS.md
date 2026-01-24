# Agent Guide: Quorum SQL

## Quick Start
- Frontend: `npm install` then `npm run dev`
- Backend (Fastify): `cd server && npm install` then `npm run dev`
- Local services (Postgres + Adminer + server): `docker-compose up`

## Repo Layout
- `src/`: React + Vite frontend (TypeScript)
- `server/src/`: Fastify backend (TypeScript, ESM)
- `supabase/`: schema + migrations
- `e2e/`: Playwright tests
- `scripts/`: local tooling and checks

## Environment
- Frontend env template: `.env.example`
- Backend expects either `DATABASE_URL` or `PGHOST/PGDATABASE/PGUSER`
- Set `SESSION_SECRET` (32+ chars) in production

## Common Commands
- `npm run dev`: frontend dev server
- `npm run build`: frontend build
- `npm run lint`: lint frontend + shared config
- `npm run typecheck`: typecheck frontend
- `npm run typecheck:server`: backend TypeScript typecheck (server/tsconfig.json)
- `npm run test:e2e`: Playwright e2e
- `npm run test:e2e:flaky`: repeat e2e to surface flaky tests
- `npm run test:e2e:flaky:report`: repeat e2e + generate flaky report
- `npm run test:unit`: Vitest unit tests
- `npm run test:unit:coverage`: unit tests with coverage thresholds
- `npm run test:unit:report`: unit tests with coverage + JUnit output
- `npm run test:integration`: server integration test skeleton
- `npm run check:large-files`: detect oversized tracked files
- `npm run report:tech-debt`: scan TODO/FIXME/XXX (non-failing)
- `npm run report:flaky-tests`: generate flaky test report from Playwright JSON
- `npm run report:test-timing`: generate slow test report from Playwright/Vitest outputs
- `npm run check:unused-deps`: detect unused dependencies/files (knip)
- `npm run check:dup-code`: detect duplicate code (jscpd)
- `npm run check:version-drift`: detect version drift (syncpack)
- `npm run check:feature-flags`: validate feature flag registry
- `npm run check:test-isolation`: guard against unintended serial tests
- `npm run format:check`: verify formatting (prettier)
- `npm run analyze`: generate bundle size report (rollup visualizer)
- `npm run docs:api`: build HTML API docs from OpenAPI
- `npm run turbo:build`: cached build via Turborepo
- `npm --prefix server run build`: compile server to `server/dist`

## Feature Flags
- Frontend uses `VITE_FEATURE_FLAGS` (comma-separated allowlist).
  - Empty means all flags are enabled (default behavior).
  - Example: `VITE_FEATURE_FLAGS=beta_banner,approvals_ui`
  - Use `flag:percent` for progressive rollout (e.g., `new_ui:25`).
- Backend uses `FEATURE_FLAGS` with the same semantics.
- Registry lives in `feature-flags.json` (validated by `npm run check:feature-flags`).

## API Schema
- OpenAPI stub lives at `docs/api/openapi.yml`.
- Update this file when adding/changing backend routes.

## Observability
- **Metrics**: set `ENABLE_METRICS=true` to expose `GET /metrics` (optionally guard with `METRICS_AUTH_TOKEN`).
- **Tracing**: set `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g., `http://jaeger:4318`) to enable OpenTelemetry tracing.
- **Error tracking (backend)**: set `SENTRY_DSN` for server-side Sentry.
- **Error tracking (frontend)**: set `VITE_SENTRY_DSN` for frontend Sentry.
- **Analytics**: set `VITE_POSTHOG_KEY` to enable PostHog.
- See `docs/observability/` for alerting rules and dashboard setup.

## Testing Notes
- Integration tests use `INTEGRATION_BASE_URL` (e.g., `http://localhost:8787`).

## CI Notes
- CI runs `npm ci`, so avoid changing `package.json` deps without updating `package-lock.json`.
- Server dependencies are installed separately in `server/`.

## Conventions
- Keep frontend TypeScript strict (noImplicitAny, strictNullChecks).
- Backend is ESM; prefer named exports and avoid `require()`.
- Add request/log context safely; do not log secrets.

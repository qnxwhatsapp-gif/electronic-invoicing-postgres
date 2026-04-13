# Electronic Invoicing PostgreSQL Migration

This workspace is the migration baseline for moving the invoicing platform from SQLite-centric runtime to a PostgreSQL-backed shared server model.

## Workspace Layout

- `apps/desktop`: Electron + React desktop client baseline
- `apps/api`: Node + Express API baseline
- `docs/migration`: migration notes and execution checkpoints

## Phase 1 Status

- New migration workspace created
- Desktop and API baselines copied into monorepo-style layout

## Phase 2 Status

- Added PostgreSQL tooling in `apps/api` (`knex`, `pg`)
- Added `knexfile.js` with support for `DATABASE_URL` and SSL toggle
- Added first schema migration in `apps/api/migrations`
- Added migration scripts in `apps/api/package.json`

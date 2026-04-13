# Electronic Invoicing PostgreSQL Migration

This workspace is the migration baseline for moving the invoicing platform from SQLite-centric runtime to a PostgreSQL-backed shared server model.

## Workspace Layout

- `apps/desktop`: Electron + React desktop client baseline
- `apps/api`: Node + Express API baseline
- `docs/migration`: migration notes and execution checkpoints

## Phase 1 Status

- New migration workspace created
- Desktop and API baselines copied into monorepo-style layout
- Ready for Phase 2 (schema and migration tooling setup)

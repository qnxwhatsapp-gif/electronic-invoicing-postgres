# Electronic Invoicing Platform Overview

This repository contains a business invoicing system split into two main applications:

- A desktop application (`apps/desktop`) built with Electron + React.
- A backend API (`apps/api`) built with Node.js + Express and migrating to PostgreSQL via Knex.

The current state is hybrid: local desktop workflows still rely on SQLite, while the API layer is structured around PostgreSQL migration.

## Repository Structure

- `apps/desktop`: Electron shell, React renderer, local server, SQLite support.
- `apps/api`: REST API, auth middleware, domain routes, Knex migrations.
- `docs/migration`: migration phase notes and checkpoints.
- `README.md`: migration-focused project context.

## Architecture At A Glance

### Desktop App (`apps/desktop`)

- Electron main process entry: `src/main/main.js`
- Preload bridge: `src/main/preload.js`
- React app/router: `src/renderer/App.jsx`
- Local embedded server: `server/index.js`

Primary responsibilities:

- UI for billing, inventory, vendors, banking, expenses, reports, settings.
- Local-first operation for offline/single-machine usage.
- Optional remote API mode through environment configuration.

### API Service (`apps/api`)

- Server entry: `src/index.js`
- Auth middleware: `src/middleware/auth.js`
- Postgres/Knex client: `src/db/pg.js`
- Route modules organized by domain under `src/routes`

Primary responsibilities:

- Authentication, authorization, and role/permission enforcement.
- CRUD and transactional operations for invoicing and accounting domains.
- Reporting endpoints for business analytics.

## Runtime Modes

### Local-First Mode

- Desktop app runs Electron + renderer + local server.
- Data is stored and queried from SQLite-backed components.

### Remote API Mode

- Desktop app can target external API using:
  - `ELECTRON_API_BASE_URL`
  - `ELECTRON_API_KEY`
- Intended for centralized deployment and multi-user scenarios.

## Core Business Domains

- **Authentication and access control**: users, roles, permissions.
- **Invoicing**: invoices, invoice items, returns/exchanges, payment states.
- **Inventory**: products, categories, stock tracking.
- **Purchasing and vendors**: vendor ledger, purchases, purchase returns, pay bills.
- **Banking and expenses**: accounts, transactions, expense categories and entries.
- **Reporting and dashboard**: sales, purchases, expenses, P&L, balance summaries, activity metrics.
- **System administration**: settings, company profile, branches, notifications, search.

## Data Layer And Migration Status

### Legacy/Local Data

- SQLite remains active in parts of desktop and API compatibility code.
- Existing local flows are still supported for continuity.

### Target Data Platform

- PostgreSQL schema is managed with Knex migrations in `apps/api/migrations`.
- Knex configuration is defined in `apps/api/knexfile.js`.
- Environment setup supports `DATABASE_URL` and SSL toggle options.

This means the project is in an active transition from SQLite-centric workflows to PostgreSQL-backed API-first architecture.

## API Surface (Route Modules)

Representative route areas in `apps/api/src/routes` include:

- `auth`, `users`, `roles`, `permissions`
- `invoices`, `products`, `customers`, `vendors`, `purchases`, `paybills`
- `banking`, `expenses`, `reports`, `dashboard`
- `settings`, `company`, `branches`, `notifications`, `search`

## Development Commands

### Desktop (`apps/desktop`)

- Install dependencies: `npm install`
- Start development app: `npm start`
- Seed local data: `npm run seed`
- Build app: `npm run build`

### API (`apps/api`)

- Install dependencies: `npm install`
- Start server: `npm start`
- Dev mode with auto-reload: `npm run dev`
- Run migrations: `npm run migrate:latest`
- Roll back migration: `npm run migrate:rollback`
- Check migration status: `npm run migrate:status`

## Recommended Next Steps

- Standardize on PostgreSQL as the single source of truth.
- Reduce duplicate SQLite/Postgres data-access paths where feasible.
- Expand onboarding docs with one clear end-to-end local and production setup flow.

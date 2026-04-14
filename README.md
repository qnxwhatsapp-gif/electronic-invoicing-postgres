# Electronic Invoicing (Desktop + API)

This project is an invoicing system with two runtime modes:

- **SQLite local mode** (desktop-first, offline-friendly)
- **PostgreSQL API mode** (shared database through Node API)

The desktop app is Electron + React. The backend API is Node + Express with Knex/PostgreSQL support.

## Project Structure

- `apps/desktop` - Electron app and React UI
- `apps/api` - REST API and PostgreSQL migrations
- `docs/migration` - migration notes
- `PROJECT_OVERVIEW.md` - architecture and module overview

## How The App Works

### 1) SQLite local mode

Flow:

`Electron app -> embedded local server -> SQLite file`

Use this mode when:

- You want quick local testing
- You do not want to run PostgreSQL/API separately

### 2) PostgreSQL mode (recommended for multi-user/shared data)

Flow:

`Electron app -> API (apps/api) -> PostgreSQL`

Use this mode when:

- You want centralized data
- You want desktop clients to use the same database
- You are validating migration from SQLite to PostgreSQL

## Prerequisites

- Node.js 20.x
- npm
- PostgreSQL 14+ (for PostgreSQL mode)
- Windows PowerShell or CMD

## Environment Configuration

### API (`apps/api/.env`)

Create `apps/api/.env` with:

```env
PORT=3001
API_KEY=change-this-to-a-long-random-secret-key
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/invocing_app
PG_SSL=false
FORCE_SEED=false
```

Notes:

- `API_KEY` must match desktop `ELECTRON_API_KEY`.
- Database name must match exactly (example above uses `invocing_app`).

## Run In SQLite Local Mode

No PostgreSQL setup needed.

```powershell
cd "apps/desktop"
npm install
npm start
```

Starts:

- React dev server (`localhost:3000`)
- Electron window
- Embedded local server (`127.0.0.1:3001`)

Default local credentials are usually seeded in local SQLite.

## Run In PostgreSQL Mode (Step by Step)

### Step 1: Create database

In pgAdmin or SQL:

```sql
CREATE DATABASE invocing_app;
```

### Step 2: Install API dependencies and migrate

```powershell
cd "apps/api"
npm install
npm run migrate:latest
```

### Step 3: Seed PostgreSQL default data

```powershell
npm run seed:pg
```

This seeds baseline data such as:

- default roles
- default users (`admin`, `priya`, `raj`, `meena`)
- branch, categories, settings

### Step 4: Start API

```powershell
npm start
```

### Step 5: Start desktop in remote API mode

Open a new terminal:

```powershell
cd "apps/desktop"
npm install
$env:ELECTRON_API_BASE_URL="http://localhost:3001/api"
$env:ELECTRON_API_KEY="change-this-to-a-long-random-secret-key"
npm start
```

Important:

- Open and use the **Electron window**, not browser only.
- If browser opens but Electron does not, kill stale `electron.exe`/`node.exe` and restart.

## Verify PostgreSQL Is Actually Used

1. Login from Electron app.
2. Create a user/customer.
3. Run query in pgAdmin:

```sql
SELECT id, name, mobile, role FROM users ORDER BY id DESC LIMIT 10;
```

If new rows appear, desktop is writing through API into PostgreSQL.

## Deployment Guide (Stepwise)

### A) Local machine deployment (dev/prototype)

1. Install PostgreSQL and create DB.
2. Configure `apps/api/.env`.
3. Run migrations and seed.
4. Start API (`npm start` in `apps/api`).
5. Start desktop with remote API env vars.

### B) API server deployment (recommended production path)

1. Provision PostgreSQL on cloud/VPS.
2. Deploy `apps/api`.
3. Set environment variables on server:
   - `PORT`
   - `API_KEY`
   - `DATABASE_URL`
   - `PG_SSL` (usually `true` on managed DB)
4. Run migrations on deployed API:
   - `npm run migrate:latest`
5. Seed once:
   - `npm run seed:pg`
6. Configure desktop clients:
   - `ELECTRON_API_BASE_URL=https://your-domain/api`
   - `ELECTRON_API_KEY=<same server API_KEY>`

### C) Desktop installer build

From `apps/desktop`:

```powershell
npm run build
```

Installer output goes to `apps/desktop/dist`.

## Common Issues

- `database does not exist`
  - DB name in `DATABASE_URL` does not match actual DB.
- `Unauthorized - invalid or missing API key`
  - `ELECTRON_API_KEY` does not match API `API_KEY`.
- Browser-only app with `window.electron` errors
  - You are opening `localhost:3000` directly; use Electron window.
- ZXing source map warnings
  - Non-blocking warnings in development builds.

## Useful Commands

From `apps/api`:

- `npm run migrate:latest`
- `npm run migrate:rollback`
- `npm run migrate:status`
- `npm run seed:pg`

From `apps/desktop`:

- `npm start`
- `npm run electron`
- `npm run build`

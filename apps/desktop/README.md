# Electronic Invoicing App

Desktop invoicing application built with Electron + React and SQLite, with support for:

- local-first runtime (`Electron -> local server -> SQLite`)
- remote runtime (`Electron -> Railway API`)

## Stack

- Electron 29
- React 18
- Express
- SQLite (`better-sqlite3`)

## Repository Structure

```text
src/
  main/
    main.js              # Electron bootstrap + local/remote mode selection
    preload.js           # bridge: invokes API channels or Electron-only handlers
    database.js          # local SQLite schema + base seed
    ipcHandlers.js       # channel handlers for app modules
    electronHandlers.js  # file-dialog and filesystem channels
    seed.js              # rich sample data seed
  renderer/
    pages/               # app screens
    components/          # reusable UI blocks
    context/             # auth context
server/
  index.js               # local server dispatcher
  handlers.js            # channel map adapter
  database.js            # server DB adapter
```

## Local Development

### Install

```bash
npm install
```

### Start app (recommended)

```bash
npm start
```

This starts:

- React dev server on `localhost:3000`
- Electron desktop app
- local API server on `127.0.0.1:3001` (when remote mode is not enabled)

### Default Login

| Role | Username | Password |
|---|---|---|
| Owner | admin | admin123 |
| Accountant | priya | accountant123 |
| Billing Operator | raj | billing123 |
| Inventory Manager | meena | inventory123 |

## Seeding Behavior

There are two seed levels:

- **Base seed** in `database.js` (runs during DB init)
- **Rich seed** in `seed.js` (sample products/customers/invoices)

Rich seed is now designed to be safe for repeated local starts:

- skips invoice/purchase seed if records already exist
- avoids duplicate item inserts

Manual seed:

```bash
npm run seed
```

## Local vs Remote API Mode

### Local Mode (default)

No environment variable needed. App uses local server.

### Remote Mode (Railway/API)

Set these before start:

```powershell
$env:ELECTRON_API_BASE_URL="https://<your-domain>/api"
$env:ELECTRON_API_KEY="<your-api-key>"
npm start
```

## Railway Deployment Notes

If using the separate server repository:

- ensure API protocol matches desktop expectations
- desktop currently calls channel dispatcher style (`POST /api` with `{ channel, data }`)
- mismatched REST-only backend can cause `404`/`401`

For SQLite on Railway:

- set `DB_PATH` correctly
- use persistent storage when available

## Build Desktop Installer

```bash
npm run build
```

Output is generated under `dist/`.

## Common Troubleshooting

- **`401 Unauthorized`**
  - `ELECTRON_API_KEY` does not match backend `API_KEY`.
- **`404 Not Found` on `/api`**
  - backend endpoint style does not match channel-dispatch protocol.
- **`Using remote API` appears unexpectedly**
  - `ELECTRON_API_BASE_URL` is still set in user/machine env vars.
- **ZXing source-map warnings**
  - harmless dev warnings from dependency packaging.

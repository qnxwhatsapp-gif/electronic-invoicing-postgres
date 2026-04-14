# Design: Migrate Electron App from Local SQLite to Bundled Express Server

**Date:** 2026-04-13  
**Status:** Approved (post-review)  
**Goal:** Eliminate the `better-sqlite3` C++ / Electron ABI build error by moving SQLite into a plain Node.js Express server spawned as a child process. Electron becomes a thin shell. React pages are untouched.

---

## Problem

`better-sqlite3` is a native C++ addon. The `postinstall` script (`electron-builder install-app-deps`) forces it to compile against Electron's internal Node.js ABI. On Node.js v22 + Electron 29, this compilation fails with a `node-gyp` error, blocking development entirely.

---

## Solution Summary

Move all database logic into a standalone Express server (`server/`) that runs as a plain `node` child process. Plain Node.js uses the system ABI — `npm install` (without the `postinstall` script) compiles `better-sqlite3` for Node.js v22 with no issues. Electron never imports `better-sqlite3` directly again.

The React renderer is **completely unchanged**: `window.electron.invoke()` continues to work because `preload.js` is rewritten as a thin dual-path adapter — HTTP for all database/business-logic channels, native IPC for the 6 Electron-only channels (file dialogs, logo upload, backup restore).

---

## Architecture

### Before

```
Electron main process
  ├─ database.js      (better-sqlite3 — Electron ABI → C++ build error)
  ├─ ipcHandlers.js   (50+ handlers, direct SQLite access + 6 Electron-only)
  └─ preload.js       (IPC bridge to renderer)

React → window.electron.invoke('invoices:getAll') → IPC → SQLite
```

### After

```
Electron main process  (thin shell)
  ├─ main.js          (spawns Express server, manages lifecycle)
  ├─ electronHandlers.js  (6 Electron-only handlers: dialog, fs, app.getPath)
  └─ preload.js       (dual-path adapter: HTTP for DB, IPC for Electron-only)

Express server  (plain Node.js child process, port 3001)
  ├─ server/index.js      (Express app, single POST /api dispatcher)
  ├─ server/database.js   (schema + seed, plain Node.js paths)
  └─ server/handlers.js   (all DB/business-logic handlers, same SQL)

React → window.electron.invoke('invoices:getAll')   [UNCHANGED]
           ↓ preload: not in ELECTRON_CHANNELS set
        POST http://localhost:3001/api { channel, data }
           ↓
        Express → handler → SQLite → { result }

React → window.electron.invoke('settings:chooseLogoFile')  [UNCHANGED]
           ↓ preload: IS in ELECTRON_CHANNELS set
        ipcRenderer.invoke('settings:chooseLogoFile')
           ↓
        electronHandlers.js → dialog.showOpenDialog() → result
```

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `server/index.js` | Express app, `POST /api` dispatcher, CORS, health endpoint |
| `server/database.js` | SQLite schema + seed, plain Node.js paths |
| `server/handlers.js` | All DB/business-logic handlers (extracted from `ipcHandlers.js`) |
| `src/main/electronHandlers.js` | 6 Electron-only handlers that stay in main process |

### Modified Files

| File | Change |
|------|--------|
| `src/main/main.js` | Spawn/kill Express server; register Electron-only handlers |
| `src/main/preload.js` | Dual-path adapter: HTTP or IPC depending on channel |
| `package.json` | Remove `postinstall`; add `express`, `cors`; fix build config |

### Deleted

| File | Reason |
|------|--------|
| `src/main/database.js` | Logic moves to `server/database.js` |
| `src/main/ipcHandlers.js` | DB handlers move to `server/handlers.js`; Electron-only to `electronHandlers.js` |

---

## Component Designs

### `server/index.js`

Single `POST /api` endpoint dispatches by channel name. A `GET /health` endpoint lets `main.js` poll for readiness instead of using a hardcoded sleep. Two crash guards ensure the server process never orphans on Windows: stdin EOF (normal close) and parent PID watchdog (crash).

```js
const express = require('express');
const cors = require('cors');
const { initDb } = require('./database');
const handlers = require('./handlers');

const app = express();

// Allow both localhost:3000 (dev) and null/file:// origin (packaged Electron)
app.use(cors({ origin: (origin, cb) => cb(null, true) }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api', async (req, res) => {
  const { channel, data } = req.body;
  const handler = handlers[channel];
  if (!handler) return res.status(404).json({ error: `Unknown channel: ${channel}` });
  try {
    const result = await handler(data);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDb();
app.listen(3001, '127.0.0.1', () => console.log('Server ready on :3001'));

// Guard 1: normal shutdown — Electron closes the stdin pipe
process.stdin.resume();
process.stdin.on('end', () => process.exit(0));

// Guard 2: crash protection on Windows — poll parent PID every 5s
// process.kill(pid, 0) throws if the process no longer exists
const parentPid = process.ppid;
setInterval(() => {
  try { process.kill(parentPid, 0); }
  catch { process.exit(0); }
}, 5000);
```

### `server/database.js`

Identical schema and seed logic to the existing `src/main/database.js`. One change: `app.getPath('userData')` (Electron API) is replaced with the equivalent plain Node.js path — same directory, same database file, existing data is preserved.

```js
const os = require('os');
const path = require('path');

const DB_PATH = path.join(
  os.homedir(), 'AppData', 'Roaming',
  'electronic-invoicing-app', 'invoicing.db'
);
```

All `CREATE TABLE`, `INSERT OR IGNORE`, and migration statements are unchanged.

### `server/handlers.js`

All DB/business-logic handlers from `ipcHandlers.js` are extracted into a plain exported object. The only structural change is removing `ipcMain.handle()` wrappers and the unused first `_` (event) argument:

```js
// Before (in ipcHandlers.js):
ipcMain.handle('invoices:getAll', async (_, data) => { /* sql */ });

// After (in server/handlers.js):
module.exports = {
  'invoices:getAll': async (data) => { /* identical sql */ },
  'auth:login':      async (data) => { /* identical */ },
  // ... all other DB handlers
};
```

All SQL queries, stock update logic, transaction sequences, auto-numbering, and notification inserts are **identical**.

### `src/main/electronHandlers.js`

The 6 handlers that use Electron-only APIs (`dialog`, `fs`, `app.getPath`) stay in the main process and are registered normally with `ipcMain.handle()`. These cannot run in a plain Node.js process.

| Channel | Electron API Used |
|---------|------------------|
| `settings:chooseLogoFile` | `dialog.showOpenDialog()` |
| `settings:chooseRestoreFile` | `dialog.showOpenDialog()` |
| `settings:uploadLogo` | `fs.copyFileSync()` + `app.getPath('userData')` |
| `settings:restoreBackup` | `fs.copyFileSync()` + `app.getPath('userData')` |
| `products:chooseImportFile` | `dialog.showOpenDialog()` |
| `products:chooseSaveFile` | `dialog.showSaveDialog()` |

```js
// src/main/electronHandlers.js
const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');

module.exports = function registerElectronHandlers() {
  ipcMain.handle('settings:chooseLogoFile', async () => {
    const result = await dialog.showOpenDialog({ ... });
    return result.canceled ? null : result.filePaths[0];
  });
  // ... remaining 5 handlers, code identical to current ipcHandlers.js
};
```

### `src/main/preload.js`

Dual-path adapter. Channels in `ELECTRON_CHANNELS` route to native IPC; everything else goes to HTTP. The `on`/`removeAllListeners` methods are preserved as stubs (not currently used by any renderer page, but kept for API surface completeness).

```js
const { contextBridge, ipcRenderer } = require('electron');

const ELECTRON_CHANNELS = new Set([
  'settings:chooseLogoFile',
  'settings:chooseRestoreFile',
  'settings:uploadLogo',
  'settings:restoreBackup',
  'products:chooseImportFile',
  'products:chooseSaveFile',
]);

contextBridge.exposeInMainWorld('electron', {
  invoke: async (channel, data) => {
    if (ELECTRON_CHANNELS.has(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    const res = await fetch('http://localhost:3001/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, data: data || {} }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.result;
  },
  on: (channel, cb) => ipcRenderer.on(channel, (_, ...args) => cb(...args)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
```

### `src/main/main.js`

Spawns the Express server before opening the window. Uses `stdin` pipe so the server exits cleanly if Electron crashes (not just closes normally). Polls `/health` instead of sleeping a fixed time.

```js
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';

let serverProcess;

function startServer() {
  // Dev: node from PATH (system Node.js v22, no ABI conflict)
  // Prod: see Production Packaging section below
  const serverPath = isDev
    ? path.join(__dirname, '../../server/index.js')
    : path.join(__dirname, '../../server/index.js'); // same for now; see Prod section

  serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', isDev ? 'inherit' : 'ignore', isDev ? 'inherit' : 'ignore'],
    detached: false,
  });
  serverProcess.on('error', (err) => console.error('[server]', err.message));
}

async function waitForServer(maxMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://localhost:3001/health');
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Express server did not start within 10 seconds');
}

app.whenReady().then(async () => {
  require('./electronHandlers')();
  startServer();
  await waitForServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
```

### `package.json`

```jsonc
// REMOVE:
"postinstall": "electron-builder install-app-deps"
// ^ This caused Electron ABI recompile of better-sqlite3

// ADD to dependencies:
"express": "^4.18.2",
"cors": "^2.8.5"

// UPDATE build.files to include server/:
"files": [
  "build/**/*",
  "src/main/**/*",
  "server/**/*",
  "node_modules/**/*",
  "!node_modules/.cache/**/*",
  "!src/renderer/**/*"
]

// UPDATE asarUnpack — server/ must be unpacked so node can execute it:
"asarUnpack": [
  "**/*.node",
  "node_modules/better-sqlite3/**/*",
  "server/**/*"
]
```

`server/` in `asarUnpack` ensures server source files land in `app.asar.unpacked/` where a plain `node` process can read them. `better-sqlite3` remains in the **root `node_modules/`** (not moved to `server/node_modules/`) — the server requires it via the standard Node.js module resolution, and it is already covered by the existing `asarUnpack` entry `node_modules/better-sqlite3/**/*`. No `server/node_modules/` directory is created.

---

## Data Flow: Request Lifecycle

```
1. React page calls:
   window.electron.invoke('invoices:getAll', { status: 'Paid' })

2. preload.js: channel not in ELECTRON_CHANNELS → HTTP path:
   POST http://localhost:3001/api
   Body: { channel: 'invoices:getAll', data: { status: 'Paid' } }

3. Express receives, dispatches:
   handlers['invoices:getAll']({ status: 'Paid' })

4. Handler runs SQLite (same SQL as before):
   db.prepare(`SELECT * FROM invoices WHERE status = ?`).all('Paid')

5. Response flows back:
   handler → Express { result: [...rows] } → preload → React page
```

---

## Production Packaging — Known Limitation & Phase 2 Plan

`spawn('node', ...)` requires a `node` binary in `PATH`. On developer machines (Node.js v22 confirmed) this works perfectly. This is sufficient for the **localhost-first** goal.

**This is a known limitation for standalone MSI distribution to end-users who may not have Node.js installed.**

### Phase 2A — Move server to Railway (recommended path)
When the server is deployed to Railway, `main.js` no longer spawns any process. `preload.js` changes one line:
```js
const API_URL = 'https://your-app.railway.app/api';
```
No packaging issue exists. This is the intended exit from the limitation.

### Phase 2B — Bundle Node.js for offline MSI (if Railway is not used)
Bundle a standalone `node.exe` for Windows x64 via `extraResources` in `electron-builder`:
```json
"extraResources": [{ "from": "resources/node.exe", "to": "node.exe" }]
```
In production `startServer()`, reference the bundled binary:
```js
const nodeBin = isDev ? 'node'
  : path.join(process.resourcesPath, 'node.exe');
serverProcess = spawn(nodeBin, [serverPath], { ... });
```
The `node.exe` (~50 MB compressed) is downloaded once from nodejs.org and committed to a `resources/` folder.

---

## Dev vs Production Summary

| Concern | Development | Production (MSI, future) |
|---------|-------------|--------------------------|
| Server start | `spawn('node', 'server/index.js')` | `spawn('<bundled-node>', '...app.asar.unpacked/server/index.js')` |
| Server logs | Terminal (`stdio: inherit`) | Suppressed |
| CORS origin | `localhost:3000` + `null` (file://) | `null` (file:// only) |
| DB path | `%APPDATA%\electronic-invoicing-app\invoicing.db` | Same |
| Railway switch | Change URL in `preload.js`, remove spawn | Already done |

---

## Implementation Steps

1. Remove `postinstall` from `package.json`; add `express` and `cors` to dependencies; update `build.files` and `asarUnpack`
2. Run `npm install` — verify `better-sqlite3` compiles without errors
3. Create `server/database.js` from `src/main/database.js` (swap `app.getPath` for `os.homedir` path)
4. Create `server/handlers.js` from `src/main/ipcHandlers.js` (convert `ipcMain.handle` registrations to exported map; exclude the 6 Electron-only channels)
5. Create `server/index.js` (Express app: `/health` + `POST /api` dispatcher + CORS + stdin EOF exit)
6. Create `src/main/electronHandlers.js` (the 6 dialog/fs handlers, code identical to current `ipcHandlers.js`)
7. Rewrite `src/main/preload.js` (dual-path adapter with `ELECTRON_CHANNELS` set)
8. Rewrite `src/main/main.js` (spawn server, poll `/health`, register Electron handlers, kill on close)
9. Delete `src/main/database.js` and `src/main/ipcHandlers.js`
10. Run `npm start` — verify app loads, all pages work, file dialogs work, invoices load

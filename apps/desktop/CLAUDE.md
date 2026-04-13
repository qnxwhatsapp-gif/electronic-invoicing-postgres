# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Invoicing App** is an Electron 29 + React 18 desktop application for small/medium businesses. It runs locally on Windows, with data stored in SQLite (better-sqlite3). A separate server-edition exists at `../invoicing-app-server-edition/` for multi-location shared database via REST API.

**SKILL.md** in the repo root is a detailed screen-by-screen specification — consult it when implementing or modifying any page's UI or business logic.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 29 |
| Frontend | React 18, React Router 6 |
| Local database | better-sqlite3 (synchronous SQLite) |
| Styling | Plain CSS (`global.css`) — no Tailwind, no CSS modules |
| Charts | Recharts |
| PDF export | jsPDF + jsPDF-AutoTable |
| Excel export | xlsx |
| Barcode scanning | @zxing/browser |
| Toasts | react-hot-toast |
| Icons | lucide-react + inline SVG |
| Password hashing | bcryptjs |
| Build | electron-builder → MSI (Windows x64) |

---

## Build Commands

```bash
# Development (React on :3000 + Electron)
npm start           # or: npm run dev

# Electron only (requires React already running)
npm run electron

# Production build
npm run build                # React build + electron-builder → dist/
npm run build:msi            # MSI installer for Windows x64

# Database
npm run seed                 # run seed.js manually (adds rich test data)
```

Dev mode automatically opens Chrome DevTools inside Electron.

---

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Owner | admin | admin123 |
| Accountant | priya | accountant123 |
| Billing Operator | raj | billing123 |
| Inventory Manager | meena | inventory123 |

---

## Project Structure

```
src/
  index.js                  ← CRA entry point (imports renderer/App)
  main/                     ← Electron main process (Node.js)
    main.js                 ← App entry, creates BrowserWindow
    preload.js              ← Context bridge: exposes window.electron.invoke()
    database.js             ← SQLite schema creation + seed data
    ipcHandlers.js          ← All ipcMain.handle() handlers (DB queries)
    seed.js                 ← Manual seed script

  renderer/                 ← React frontend (browser context)
    App.jsx                 ← Router, ProtectedRoute, AppLayout
    context/
      AuthContext.jsx       ← Auth state, login/logout, can() permission check
    components/
      Sidebar.jsx           ← Navigation sidebar
      TopBar.jsx            ← Header with search (Ctrl+K), notifications, user menu
      BarcodeScanner.jsx    ← ZXing webcam barcode scanner
      AccessDenied.jsx      ← Permission denied page
    hooks/
      useBarcodeGun.js      ← Detects USB barcode gun (keystrokes < 100ms apart)
      useSearch.js          ← Global search with 300ms debounce via search:global IPC
    pages/
      Login.jsx             ← Role → User dropdown login
      Dashboard.jsx         ← Stats cards, charts, recent invoices
      BillingInvoice.jsx    ← Invoice creation, list, view, print, return
      InventoryServices.jsx ← Products/stock management
      VendorsPurchases.jsx  ← Vendors, purchase orders, returns, pay bills
      Banking.jsx           ← Cash/bank accounts, transactions, transfer
      Expenses.jsx          ← Expense tracking
      Reports.jsx           ← Sales, stock, P&L, customer/vendor outstanding
      Settings.jsx          ← Company, users, roles, branches, backup, invoice designer
    styles/
      global.css            ← All app styles (single file)
```

---

## Database Location

- **Windows:** `%APPDATA%\electronic-invoicing-app\invoicing.db`
- **Mac:** `~/Library/Application Support/electronic-invoicing-app/invoicing.db`

The DB is auto-created on first launch. Run `npm run seed` after first launch to populate test data.

---

## IPC Communication Pattern

The renderer CANNOT access Node.js/SQLite directly. All DB calls go through IPC:

```js
// Renderer (React) — calls main process
const result = await window.electron.invoke('invoices:getAll', { status: 'Paid' });

// Main process (ipcHandlers.js) — runs SQLite query
ipcMain.handle('invoices:getAll', async (_, { status }) => {
  return db.prepare(`SELECT * FROM invoices WHERE status = ?`).all(status);
});
```

**preload.js** bridges them:
```js
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data)
});
```

**Never** use `require('electron')` or `require('better-sqlite3')` in renderer files.

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `users` | Staff accounts with roles |
| `user_roles` | Custom role definitions |
| `permissions` / `role_permissions` / `user_permissions` | RBAC |
| `invoices` | Sales invoices |
| `invoice_items` | Line items for invoices |
| `return_exchange` | Invoice returns |
| `products` | Inventory items |
| `categories` | Product categories |
| `customers` | Customer records |
| `vendors` | Supplier records |
| `purchase_invoices` | Purchase orders |
| `purchase_invoice_items` | PO line items |
| `purchase_returns` / `purchase_return_items` | PO returns |
| `pay_bills` | Vendor bill payments |
| `accounts` | Cash/bank accounts |
| `banking_transactions` | Transaction ledger |
| `expenses` | Business expenses |
| `expense_categories` | Expense categories |
| `branches` | Business locations |
| `notifications` | In-app notifications |
| `app_settings` | Key-value settings store |
| `company_profile` | Company info, logo, bank details |

---

## IPC Handler Naming Conventions

```
module:action
examples:
  invoices:getAll     → SELECT * FROM invoices
  invoices:create     → INSERT INTO invoices
  invoices:update     → UPDATE invoices
  invoices:delete     → DELETE FROM invoices
  invoices:getById    → SELECT * FROM invoices WHERE id=?
  invoices:updateStatus → UPDATE invoices SET status=?
  products:findByBarcode
  purchases:getReturns
  purchases:createReturn
  settings:getAll / settings:saveAll
  settings:getCompany / settings:saveCompany
  dashboard:getStats
  reports:sales / reports:stock / reports:profitLoss
  search:global
```

---

## Roles & Permissions

- **Owner** — full access, bypasses all permission checks
- **Admin / Manager / Cashier / Staff** — configurable per-module RBAC
- System roles seeded in `user_roles` table
- `can(module, action)` from `useAuth()` — returns boolean
- `module` values: `dashboard`, `billing`, `inventory`, `vendors`, `banking`, `expenses`, `reports`, `settings`

---

## Styling Rules

- **Single CSS file:** `src/renderer/styles/global.css`
- **No Tailwind, no CSS modules, no styled-components**
- Common class names: `.btn`, `.btn-black`, `.btn-primary`, `.form-input`, `.form-select`, `.form-label`, `.modal-overlay`, `.modal`, `.stat-card`, `.stat-cards`
- Stat cards grid: `repeat(3, 1fr)` — **do not change to 4** (only 3 render)
- Colors: background `#f5f5f5`, card white, text `#111`
- Kebab menu buttons: use inline SVG three-dot icon (no Unicode `⋮` — encoding issues on Windows)

---

## Encoding Rules (CRITICAL)

**PowerShell `Set-Content` corrupts multi-byte UTF-8 characters** (writes as Latin-1). This has caused bugs before.

Rules:
- **Never use Unicode emoji in JSX** — use text labels like `[P]` Print, `[X]` Delete
- **Never use `₹` directly** — use `Rs.` or load from settings
- **Never use `⋮`** — use inline SVG three-dot icon
- **Use HTML entities** where possible: `&middot;`, `&larr;`, `&ndash;`, `&amp;`
- If a file has garbled chars (`â‹®`, `â‚¹`), rewrite the entire file with the Write tool

---

## Currency & Language Settings

Stored in `app_settings` table as key-value pairs:

| Key | Default | Options |
|-----|---------|---------|
| `currency` | `INR` | INR, USD, EUR, GBP, AED, ZAR, XOF, XAF |
| `currency_symbol` | `Rs.` | Matches selected currency |
| `language` | `en` | en, fr, en-ZA, af, zu, xh, st, tn, ts, ve, nr, ss, hi, ta, te |
| `date_format` | `DD/MM/YYYY` | DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD |

CFA Franc currencies: XOF (West Africa, FCFA), XAF (Central Africa, FCFA)

---

## Server Edition (Multi-Location)

A copy of the project at `../invoicing-app-server-edition/` uses a REST API instead of local SQLite:

- **Server:** `server/` subdirectory — Node.js + Express + better-sqlite3
- **Deployed on:** Railway (https://github.com/vivekcrazy25/invoicing-server)
- **Auth:** `X-Api-Key` header
- **Desktop client:** `src/main/api.js` wraps `fetch()`, reads `server-config.json` from userData
- **Config file:** `%APPDATA%\invoicing-app\server-config.json` — `{ serverUrl, apiKey }`
- **Health check:** `GET /health` (public, no auth)

---

## Common Patterns

### Adding a new page
1. Create `src/renderer/pages/NewPage.jsx`
2. Add route in `App.jsx`
3. Add nav item in `Sidebar.jsx`
4. Add IPC handlers in `ipcHandlers.js`
5. Add permission module in RBAC if needed

### Adding a new IPC handler
```js
// ipcHandlers.js
ipcMain.handle('module:action', async (_, data) => {
  const db = getDb();
  // synchronous better-sqlite3 API
  return db.prepare(`SELECT ...`).all(...params);
});
```

### Adding a new setting
```js
// database.js seed section
insSet.run('my_setting', 'default_value');

// Settings.jsx — add to settings state and UI
// ipcHandlers.js — settings:getAll and settings:saveAll handle it automatically
```

### Modal pattern
```jsx
const [showModal, setShowModal] = useState(false);
const [selected, setSelected] = useState(null);

// Trigger
<button onClick={() => { setSelected(row); setShowModal(true); }}>Open</button>

// Modal
{showModal && <MyModal item={selected} onClose={() => setShowModal(false)} />}
```

---

## Known Issues & Past Fixes

| Issue | Fix Applied |
|-------|------------|
| Unicode chars garbled in JSX | Rewrote files using Write tool; use ASCII/SVG only |
| Dashboard blank space (6 cards) | CSS was `repeat(4,1fr)` → fixed to `repeat(3,1fr)` |
| Purchase Returns tab empty | `loadAll()` was missing `purchases:getReturns` call |
| Purchase Return wrong columns | Used wrong column names; correct: `po_number`, `return_reason`, `return_qty`, `return_total`, `order_date` |
| VendorsPurchases search broken | Search inputs had no `value`/`onChange` — wired up state |
| Railway deploy healthcheck fail | `app.listen()` moved before `initDb()` so `/health` always responds |

---

## Do Not

- Do NOT add `console.log` debugging statements without removing them after
- Do NOT use `fs`, `path`, `require()` in renderer files (browser context)
- Do NOT install new npm packages without checking if an existing dep covers the need
- Do NOT modify `preload.js` structure — it intentionally uses a whitelist
- Do NOT use `grep`/`find`/`cat` shell commands — use Grep/Glob/Read tools
- Do NOT change the stat-card grid from `repeat(3, 1fr)` to 4
- Do NOT use Unicode emoji or `₹`/`⋮` characters directly in JSX files

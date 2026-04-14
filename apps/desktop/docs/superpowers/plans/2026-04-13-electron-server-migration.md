# Electron → Express Server Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move SQLite out of the Electron main process into a plain Node.js Express server spawned as a child process, eliminating the `better-sqlite3` C++ / Electron ABI build error permanently.

**Architecture:** Electron becomes a thin shell with no native deps. A new `server/` directory holds the Express app + all DB logic (extracted from `ipcHandlers.js` and `database.js`). The `preload.js` becomes a dual-path HTTP adapter — DB channels go via `fetch()` to `localhost:3001`, the 6 Electron-specific channels (file dialogs, logo upload, backup restore) stay as native IPC. All 9 React pages and all hooks are untouched.

**Tech Stack:** Electron 29, React 18, Express 4, better-sqlite3 9, bcryptjs, cors, Node.js v22 (system)

**Spec:** `docs/superpowers/specs/2026-04-13-electron-server-migration-design.md`

---

> **No automated test framework exists in this project.** Each task includes a targeted manual verification step you must actually run before committing. Do not skip verification steps.

---

### Task 1: Update package.json — remove postinstall, add express + cors

**Files:**
- Modify: `package.json`

The `postinstall` script (`electron-builder install-app-deps`) is the root cause — it forces `better-sqlite3` to recompile for Electron's ABI. Removing it means `npm install` compiles for system Node.js v22 instead.

- [ ] **Step 1: Edit package.json**

Open `package.json`. Make all three changes below in one edit:

**Remove** the entire `postinstall` line from `"scripts"`:
```json
"postinstall": "electron-builder install-app-deps",
```

**Add** to `"dependencies"`:
```json
"cors": "^2.8.5",
"express": "^4.18.2",
```

**Replace** `"files"` and `"asarUnpack"` inside `"build"`:
```json
"files": [
  "build/**/*",
  "src/main/**/*",
  "server/**/*",
  "node_modules/**/*",
  "!node_modules/.cache/**/*",
  "!src/renderer/**/*"
],
"asarUnpack": [
  "**/*.node",
  "node_modules/better-sqlite3/**/*",
  "server/**/*"
],
```

- [ ] **Step 2: Delete node_modules and reinstall**

```bash
cd "C:\Users\vivek.singh\Downloads\electronic-invoicing-app-feature-ui-improvements-and-branch-assignment\electronic-invoicing-app-feature-ui-improvements-and-branch-assignment"
rmdir /s /q node_modules
npm install
```

- [ ] **Step 3: Verify better-sqlite3 compiled successfully**

Expected: `npm install` completes with no `gyp ERR!` lines. You should see something like:
```
added N packages in Xs
```

If you still see `gyp ERR!`, the `postinstall` line was not fully removed. Check `package.json` again.

- [ ] **Step 4: Verify express and cors are installed**

```bash
node -e "require('express'); require('cors'); console.log('OK')"
```
Expected output: `OK`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove postinstall, add express+cors, fix build config"
```

---

### Task 2: Create server/database.js

**Files:**
- Create: `server/database.js`

This is a direct copy of `src/main/database.js` with one change: replace `app.getPath('userData')` (Electron API, not available in plain Node.js) with `os.homedir() + AppData/Roaming/electronic-invoicing-app/`. The resolved path is identical on Windows — same `.db` file, existing data preserved.

- [ ] **Step 1: Create the server directory**

```bash
mkdir server
```

- [ ] **Step 2: Create server/database.js**

Create `server/database.js` with this content (complete file — read `src/main/database.js` first and copy its full content, then apply the changes below):

The file starts with:
```js
const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
```

Replace the DB_PATH line:
```js
// REMOVE this (Electron-only API):
// const { app } = require('electron');
// const DB_PATH = path.join(app.getPath('userData'), 'invoicing.db');

// REPLACE with (plain Node.js, same Windows path):
const DB_PATH = path.join(
  os.homedir(), 'AppData', 'Roaming',
  'electronic-invoicing-app', 'invoicing.db'
);
```

The existing `src/main/database.js` exports `{ initialize, getDb }`. In `server/database.js`, rename the exported function from `initialize` to `initDb` so the naming is consistent with all the `require('./database')` calls in the plan. Keep `getDb()` exactly as-is. Export both:
```js
module.exports = { initDb, getDb };
```

Everything else in the file — `createTables()`, `runMigrations()`, `seedDefaultData()`, all SQL — is **identical** to `src/main/database.js`.

- [ ] **Step 3: Verify the file loads without errors**

```bash
node -e "const { initDb, getDb } = require('./server/database'); initDb(); console.log('DB OK:', getDb() ? 'connected' : 'failed');"
```

Expected output: `DB OK: connected`

If it errors with `app is not defined`, you missed the `app.getPath` replacement. Check the top of `server/database.js`.

- [ ] **Step 4: Commit**

```bash
git add server/database.js
git commit -m "feat: add server/database.js with plain Node.js path"
```

---

### Task 3: Create server/handlers.js

**Files:**
- Create: `server/handlers.js`

All DB/business-logic handlers from `ipcHandlers.js` converted to a plain exported object. The 6 Electron-only channels are excluded (they go to `electronHandlers.js` in Task 5). The complete file content is provided below — copy it exactly.

- [ ] **Step 1: Create server/handlers.js with this exact content**

```js
const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

// ─── helper: generateNotifications ──────────────────────────────────────────
function generateNotifications(db) {
  const lowStock = db.prepare(`SELECT id, name, current_stock, status FROM products WHERE status IN ('Low','Critical') AND is_active=1`).all();
  for (const p of lowStock) {
    const exists = db.prepare(`SELECT id FROM notifications WHERE type=? AND message LIKE ?`).get('low_stock', `%${p.name}%`);
    if (!exists) {
      db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`)
        .run('low_stock', p.status === 'Critical' ? 'Critical Stock Alert' : 'Low Stock Alert',
          `${p.name} has only ${p.current_stock} unit(s) remaining`, '/inventory');
    }
  }
  const creditInvoices = db.prepare(`SELECT id, invoice_no, customer_name, grand_total, invoice_date FROM invoices WHERE is_credit_sale=1 AND status='Credit' AND date(invoice_date) <= date('now','-3 days')`).all();
  for (const inv of creditInvoices) {
    const exists = db.prepare(`SELECT id FROM notifications WHERE type='credit_due' AND message LIKE ?`).get(`%${inv.invoice_no}%`);
    if (!exists) {
      db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`)
        .run('credit_due', 'Payment Overdue', `Invoice ${inv.invoice_no} from ${inv.customer_name} (Rs.${inv.grand_total}) is past due`, '/billing');
    }
  }
  const overdueBills = db.prepare(`SELECT id, po_number, vendor_name, grand_total FROM purchase_invoices WHERE status NOT IN ('Received','Paid') AND due_date IS NOT NULL AND date(due_date) < date('now')`).all();
  for (const bill of overdueBills) {
    const exists = db.prepare(`SELECT id FROM notifications WHERE type='bill_due' AND message LIKE ?`).get(`%${bill.po_number}%`);
    if (!exists) {
      db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`)
        .run('bill_due', 'Bill Payment Due', `Purchase ${bill.po_number} from ${bill.vendor_name} (Rs.${bill.grand_total}) is overdue`, '/vendors');
    }
  }
}

const CLEAR_TABLES = {
  billing:   ['invoice_items', 'invoices', 'return_exchange_items', 'return_exchange'],
  inventory: ['products', 'categories'],
  vendors:   ['purchase_return_items', 'purchase_returns', 'purchase_invoice_items', 'purchase_invoices', 'pay_bills', 'vendors'],
  banking:   ['banking_transactions'],
  expenses:  ['expenses'],
  reports:   [],
  notifications: ['notifications'],
};

module.exports = {

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  'auth:login': async ({ username, password }) => {
    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE (name = ? OR mobile = ?) AND is_active = 1`).get(username, username);
    if (!user) return { success: false, error: 'Invalid username or password.' };
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return { success: false, error: 'Invalid username or password.' };
    const { password: _pw, ...safeUser } = user;
    return { success: true, user: safeUser };
  },

  'auth:getRoles': async () => {
    return getDb().prepare(`SELECT DISTINCT role FROM users WHERE is_active = 1 ORDER BY role`).all().map(r => r.role);
  },

  'auth:getUsersByRole': async ({ role }) => {
    return getDb().prepare(`SELECT id, name, mobile FROM users WHERE role = ? AND is_active = 1 ORDER BY name`).all(role);
  },

  // ─── USER ROLES ───────────────────────────────────────────────────────────
  'roles:getAll': async () => {
    return getDb().prepare(`SELECT * FROM user_roles ORDER BY is_system DESC, name ASC`).all();
  },

  'roles:create': async ({ name }) => {
    try {
      getDb().prepare(`INSERT INTO user_roles (name, is_system) VALUES (?, 0)`).run(name.trim());
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Role already exists' };
    }
  },

  'roles:delete': async ({ id }) => {
    const db = getDb();
    const role = db.prepare(`SELECT * FROM user_roles WHERE id = ?`).get(id);
    if (!role) return { success: false, error: 'Role not found' };
    if (role.is_system) return { success: false, error: 'Cannot delete a system role' };
    const inUse = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = ?`).get(role.name).c;
    if (inUse > 0) return { success: false, error: `Role is assigned to ${inUse} user(s)` };
    db.prepare(`DELETE FROM user_roles WHERE id = ?`).run(id);
    return { success: true };
  },

  // ─── PERMISSIONS ──────────────────────────────────────────────────────────
  'permissions:getForUser': async ({ userId, role }) => {
    const db = getDb();
    if (role === 'Owner') return null;
    const overrides = db.prepare(`SELECT p.module, p.action, up.granted FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = ?`).all(userId);
    const rolePerms = db.prepare(`SELECT p.module, p.action, rp.granted FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role = ?`).all(role);
    const map = {};
    for (const rp of rolePerms) {
      if (!map[rp.module]) map[rp.module] = {};
      map[rp.module][rp.action] = rp.granted === 1;
    }
    for (const up of overrides) {
      if (!map[up.module]) map[up.module] = {};
      map[up.module][up.action] = up.granted === 1;
    }
    return map;
  },

  'permissions:saveForUser': async ({ userId, permissions }) => {
    const db = getDb();
    db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(userId);
    const getPerm = db.prepare('SELECT id FROM permissions WHERE module = ? AND action = ?');
    const ins = db.prepare('INSERT INTO user_permissions (user_id, permission_id, granted) VALUES (?,?,?)');
    for (const [module, actions] of Object.entries(permissions)) {
      for (const [action, granted] of Object.entries(actions)) {
        const perm = getPerm.get(module, action);
        if (perm) ins.run(userId, perm.id, granted ? 1 : 0);
      }
    }
    return { success: true };
  },

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  'dashboard:getStats': async ({ branch_id } = {}) => {
    const db = getDb();
    const bFilter = branch_id ? `AND branch_id = ${parseInt(branch_id)}` : '';
    const totalSale = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM invoices WHERE status NOT IN ('Draft') ${bFilter}`).get().val;
    const totalProfit = db.prepare(`SELECT COALESCE(SUM(ii.qty * (ii.rate - p.purchase_price)),0) as val FROM invoice_items ii JOIN products p ON p.id = ii.product_id JOIN invoices i ON i.id = ii.invoice_id WHERE i.status NOT IN ('Draft') ${bFilter.replace('branch_id','i.branch_id')}`).get().val;
    const pendingPayment = db.prepare(`SELECT COALESCE(SUM(grand_total - paid_amount),0) as val FROM invoices WHERE is_credit_sale = 1 AND status NOT IN ('Draft') ${bFilter}`).get().val;
    const cashBalance = db.prepare(`SELECT COALESCE(SUM(current_balance),0) as val FROM accounts WHERE account_type = 'Cash'`).get().val;
    const bankBalance = db.prepare(`SELECT COALESCE(SUM(current_balance),0) as val FROM accounts WHERE account_type = 'Bank'`).get().val;
    const lowStock = db.prepare(`SELECT COUNT(*) as val FROM products WHERE status IN ('Low','Critical') AND is_active = 1`).get().val;
    const monthlySales = db.prepare(`SELECT strftime('%m', invoice_date) as month, COALESCE(SUM(grand_total),0) as total FROM invoices WHERE status NOT IN ('Draft') AND strftime('%Y', invoice_date) = strftime('%Y','now') ${bFilter} GROUP BY month ORDER BY month`).all();
    const recentInvoices = db.prepare(`SELECT * FROM invoices WHERE 1=1 ${bFilter} ORDER BY created_at DESC LIMIT 5`).all();
    const topItems = db.prepare(`SELECT ii.product_name, SUM(ii.qty) as units_sold, SUM(ii.amount) as revenue FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.status NOT IN ('Draft') ${bFilter.replace('branch_id','i.branch_id')} GROUP BY ii.product_name ORDER BY units_sold DESC LIMIT 7`).all();
    const branchRevenue = db.prepare(`SELECT b.name, COALESCE(SUM(i.grand_total),0) as revenue FROM branches b LEFT JOIN invoices i ON i.branch_id = b.id AND i.status NOT IN ('Draft') WHERE b.is_active=1 GROUP BY b.id, b.name ORDER BY revenue DESC`).all();
    return { totalSale, totalProfit, pendingPayment, cashBalance, bankBalance, lowStock, monthlySales, recentInvoices, topItems, branchRevenue };
  },

  // ─── INVOICES ─────────────────────────────────────────────────────────────
  'invoices:getAll': async ({ status, search, branch_id } = {}) => {
    const db = getDb();
    let q = `SELECT i.*, u.name as seller_name, (SELECT COUNT(*) FROM invoice_items WHERE invoice_id=i.id) as item_count FROM invoices i LEFT JOIN users u ON u.id = i.seller_id WHERE 1=1`;
    const params = [];
    if (status && status !== 'All') { q += ` AND i.status = ?`; params.push(status); }
    if (search) { q += ` AND (i.invoice_no LIKE ? OR i.customer_name LIKE ? OR i.customer_phone LIKE ?)`; const s = `%${search}%`; params.push(s, s, s); }
    if (branch_id) { q += ` AND i.branch_id = ?`; params.push(branch_id); }
    q += ` ORDER BY i.created_at DESC`;
    return db.prepare(q).all(...params);
  },

  'invoices:getById': async ({ id }) => {
    const db = getDb();
    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(id);
    if (!invoice) return null;
    invoice.items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(id);
    return invoice;
  },

  'invoices:create': async (data) => {
    const db = getDb();
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const num = parseInt(last.invoice_no.replace(`ETS-${year}`, ''), 10); seq = isNaN(num) ? 1 : num + 1; }
    const invoice_no = `ETS-${year}${String(seq).padStart(3, '0')}`;
    const insert = db.prepare(`INSERT INTO invoices (invoice_no, invoice_date, customer_name, customer_phone, seller_id, branch_id, subtotal, tax_amount, grand_total, payment_mode, cash_amount, online_amount, internal_notes, status, type, is_credit_sale, paid_amount, created_by) VALUES (@invoice_no,@invoice_date,@customer_name,@customer_phone,@seller_id,@branch_id,@subtotal,@tax_amount,@grand_total,@payment_mode,@cash_amount,@online_amount,@internal_notes,@status,@type,@is_credit_sale,@paid_amount,@created_by)`);
    const result = insert.run({ invoice_no, invoice_date: data.invoice_date, customer_name: data.customer_name || '', customer_phone: data.customer_phone || '', seller_id: data.seller_id || null, branch_id: data.branch_id || null, subtotal: data.subtotal || 0, tax_amount: data.tax_amount || 0, grand_total: data.grand_total || 0, payment_mode: data.payment_mode || 'Cash', cash_amount: data.split_cash || data.cash_amount || null, online_amount: data.split_card || data.online_amount || null, internal_notes: data.notes || data.internal_notes || '', status: data.status || 'Paid', type: data.type || 'Sale', is_credit_sale: data.is_credit_sale || 0, paid_amount: data.is_credit_sale ? 0 : data.grand_total, created_by: data.created_by || null });
    const invoiceId = result.lastInsertRowid;
    if (data.items && data.items.length) {
      const insItem = db.prepare(`INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, rate, amount) VALUES (?,?,?,?,?,?,?)`);
      const updStock = db.prepare(`UPDATE products SET current_stock = current_stock - ?, status = CASE WHEN current_stock - ? <= 5 THEN 'Critical' WHEN current_stock - ? <= reorder_level THEN 'Low' ELSE 'Good' END WHERE id = ?`);
      for (const item of data.items) {
        insItem.run(invoiceId, item.product_id, item.product_code || item.sku || '', item.product_name || item.name || '', item.qty, item.rate, item.amount);
        if (data.status !== 'Draft') updStock.run(item.qty, item.qty, item.qty, item.product_id);
      }
    }
    if (data.status !== 'Draft' && !data.is_credit_sale) {
      const year2 = new Date().getFullYear().toString().slice(-2);
      const lastTxn = db.prepare(`SELECT txn_id FROM banking_transactions ORDER BY id DESC LIMIT 1`).get();
      let txnSeq = 1;
      if (lastTxn) { const n = parseInt(lastTxn.txn_id.replace(`TXN-${year2}`,''),10); txnSeq = isNaN(n)?1:n+1; }
      const txn_id = `TXN-${year2}${String(txnSeq).padStart(3,'0')}`;
      const acct = db.prepare(`SELECT id FROM accounts WHERE account_type='Cash' AND is_primary=1 LIMIT 1`).get() || db.prepare(`SELECT id FROM accounts WHERE account_type='Cash' LIMIT 1`).get();
      if (acct) {
        db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`).run(txn_id, acct.id, 'Cash Account', data.invoice_date, `Sale: ${invoice_no}`, 'Credit', data.grand_total);
        db.prepare(`UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`).run(data.grand_total, acct.id);
      }
    }
    if (data.is_credit_sale) {
      db.prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`).run('credit_due', 'Credit Sale Created', `Invoice ${invoice_no} for ${data.customer_name || 'Walk-in'} (Rs.${data.grand_total}) recorded as credit sale`, '/billing');
    }
    return { success: true, invoice_no, id: invoiceId };
  },

  'invoices:updateStatus': async ({ id, status, paid_amount }) => {
    getDb().prepare(`UPDATE invoices SET status = ?, paid_amount = COALESCE(?, paid_amount), updated_at = datetime('now') WHERE id = ?`).run(status, paid_amount, id);
    return { success: true };
  },

  'invoices:delete': async ({ id }) => {
    getDb().prepare(`DELETE FROM invoices WHERE id = ?`).run(id);
    return { success: true };
  },

  'invoices:update': async ({ id, data }) => {
    const db = getDb();
    db.prepare(`UPDATE invoices SET invoice_date=@invoice_date, customer_name=@customer_name, customer_phone=@customer_phone, seller_id=@seller_id, branch_id=@branch_id, subtotal=@subtotal, tax_amount=@tax_amount, grand_total=@grand_total, payment_mode=@payment_mode, cash_amount=@cash_amount, online_amount=@online_amount, internal_notes=@internal_notes, status=@status, type=@type, is_credit_sale=@is_credit_sale, paid_amount=@paid_amount, updated_at=datetime('now') WHERE id=@id`).run({ id, invoice_date: data.invoice_date, customer_name: data.customer_name || '', customer_phone: data.customer_phone || '', seller_id: data.seller_id || null, branch_id: data.branch_id || null, subtotal: data.subtotal || 0, tax_amount: data.tax_amount || 0, grand_total: data.grand_total || 0, payment_mode: data.payment_mode || 'Cash', cash_amount: data.cash_amount || null, online_amount: data.online_amount || null, internal_notes: data.internal_notes || '', status: data.status || 'Draft', type: data.type || 'Sale', is_credit_sale: data.is_credit_sale || 0, paid_amount: data.paid_amount || 0 });
    if (data.items && data.items.length) {
      db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(id);
      const insItem = db.prepare(`INSERT INTO invoice_items (invoice_id, product_id, product_code, product_name, qty, rate, amount) VALUES (?,?,?,?,?,?,?)`);
      for (const item of data.items) insItem.run(id, item.product_id, item.product_code || '', item.product_name || item.name || '', item.qty, item.rate, item.amount);
    }
    return { success: true };
  },

  'invoices:autoComplete': async () => {
    const result = getDb().prepare(`UPDATE invoices SET status='Completed', updated_at=datetime('now') WHERE status IN ('Paid','Credit','Active') AND CAST(julianday('now') - julianday(invoice_date) AS INTEGER) > 15`).run();
    return { success: true, updated: result.changes };
  },

  // ─── RETURNS ──────────────────────────────────────────────────────────────
  'returns:getAll': async () => {
    return getDb().prepare(`SELECT * FROM return_exchange ORDER BY date DESC`).all();
  },

  'returns:create': async (data) => {
    const db = getDb();
    if (data.original_invoice_id) {
      const origInv = db.prepare(`SELECT invoice_date, status FROM invoices WHERE id=?`).get(data.original_invoice_id);
      if (origInv) {
        const daysSince = db.prepare(`SELECT CAST(julianday('now') - julianday(?) AS INTEGER) as days`).get(origInv.invoice_date).days;
        if (daysSince > 15) return { success: false, error: 'Return period of 15 days has expired for this invoice.' };
        if (origInv.status === 'Completed') return { success: false, error: 'This invoice is completed and cannot be returned.' };
      }
    }
    const r = db.prepare(`INSERT INTO return_exchange (original_invoice_id, invoice_no, customer_name, type, total_items_sold, items_returned, return_amount, exchange_amount, net_amount, status, created_by) VALUES (@original_invoice_id,@invoice_no,@customer_name,@type,@total_items_sold,@items_returned,@return_amount,@exchange_amount,@net_amount,@status,@created_by)`).run(data);
    if (data.items) {
      const upd = db.prepare(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`);
      for (const item of data.items) if (item.returned_qty > 0) upd.run(item.returned_qty, item.product_id);
    }
    return { success: true, id: r.lastInsertRowid };
  },

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────
  'products:getAll': async ({ search, category, status } = {}) => {
    const db = getDb();
    let q = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.is_active = 1`;
    const params = [];
    if (search) { q += ` AND (p.name LIKE ? OR p.sku LIKE ?)`; const s = `%${search}%`; params.push(s, s); }
    if (category && category !== 'All Categories') { q += ` AND c.name = ?`; params.push(category); }
    if (status && status !== 'All Status') { q += ` AND p.status = ?`; params.push(status); }
    return db.prepare(q).all(...params);
  },

  'products:findByBarcode': async (data) => {
    const db = getDb();
    const barcode = typeof data === 'string' ? data : data?.barcode;
    return db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.barcode = ? AND p.is_active = 1`).get(barcode);
  },

  'products:create': async (data) => {
    const db = getDb();
    const last = db.prepare(`SELECT sku FROM products ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.sku.replace('ITM-', ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const sku = `ITM-${String(seq).padStart(3, '0')}`;
    const initStock = data.current_stock || data.opening_stock || 0;
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    db.prepare(`INSERT INTO products (sku, name, category_id, unit, hsn_code, purchase_price, selling_price, opening_stock, current_stock, reorder_level, barcode, description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(sku, data.name, data.category_id || null, data.unit || 'pcs', data.hsn_code || '', data.purchase_price || 0, data.selling_price || 0, initStock, initStock, reorderLvl, data.barcode || '', data.description || '');
    return { success: true, sku };
  },

  'products:update': async ({ id, ...data }) => {
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    getDb().prepare(`UPDATE products SET name=?,category_id=?,unit=?,hsn_code=?,purchase_price=?,selling_price=?,current_stock=?,reorder_level=?,barcode=?,description=? WHERE id=?`).run(data.name, data.category_id || null, data.unit || 'pcs', data.hsn_code || '', data.purchase_price || 0, data.selling_price || 0, data.current_stock || 0, reorderLvl, data.barcode || '', data.description || '', id);
    return { success: true };
  },

  'products:delete': async ({ id }) => {
    getDb().prepare(`UPDATE products SET is_active = 0 WHERE id = ?`).run(id);
    return { success: true };
  },

  'products:getInventoryStats': async () => {
    const db = getDb();
    const total = db.prepare(`SELECT COUNT(*) as val FROM products WHERE is_active=1`).get().val;
    const lowAlert = db.prepare(`SELECT COUNT(*) as val FROM products WHERE status IN ('Low','Critical') AND is_active=1`).get().val;
    const costVal = db.prepare(`SELECT COALESCE(SUM(current_stock*purchase_price),0) as val FROM products WHERE is_active=1`).get().val;
    const sellVal = db.prepare(`SELECT COALESCE(SUM(current_stock*selling_price),0) as val FROM products WHERE is_active=1`).get().val;
    return { total, lowAlert, costVal, sellVal };
  },

  'products:importCSV': async ({ rows }) => {
    const db = getDb();
    const catMap = {};
    db.prepare(`SELECT id, name FROM categories`).all().forEach(c => { catMap[c.name.toLowerCase()] = c.id; });
    const lastProd = db.prepare(`SELECT sku FROM products ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (lastProd) { const n = parseInt(lastProd.sku.replace('ITM-',''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const ins = db.prepare(`INSERT OR IGNORE INTO products (sku,name,category_id,purchase_price,selling_price,opening_stock,current_stock,reorder_level,barcode,unit,hsn_code) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    const upd = db.prepare(`UPDATE products SET purchase_price=?,selling_price=?,current_stock=?,reorder_level=?,barcode=?,unit=?,hsn_code=? WHERE name=?`);
    let inserted = 0, updated = 0;
    for (const row of rows) {
      const catId = catMap[(row.category||'').toLowerCase()] || null;
      const stock = parseInt(row.current_stock||row.stock||0, 10);
      const existing = db.prepare(`SELECT id FROM products WHERE name=?`).get(row.name);
      if (existing) { upd.run(parseFloat(row.purchase_price||0), parseFloat(row.selling_price||0), stock, parseInt(row.reorder_level||10,10), row.barcode||'', row.unit||'pcs', row.hsn_code||'', row.name); updated++; }
      else { const sku = `ITM-${String(seq).padStart(3,'0')}`; seq++; ins.run(sku, row.name, catId, parseFloat(row.purchase_price||0), parseFloat(row.selling_price||0), stock, stock, parseInt(row.reorder_level||10,10), row.barcode||'', row.unit||'pcs', row.hsn_code||''); inserted++; }
    }
    db.prepare(`UPDATE products SET status = CASE WHEN current_stock <= 5 THEN 'Critical' WHEN current_stock <= reorder_level THEN 'Low' ELSE 'Good' END WHERE is_active=1`).run();
    return { success: true, inserted, updated };
  },

  'products:exportCSV': async () => {
    return getDb().prepare(`SELECT p.sku,p.name,c.name as category,p.unit,p.hsn_code,p.purchase_price,p.selling_price,p.current_stock,p.reorder_level,p.barcode FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 ORDER BY p.sku`).all();
  },

  // ─── CATEGORIES ───────────────────────────────────────────────────────────
  'categories:getAll': async () => {
    return getDb().prepare(`SELECT * FROM categories ORDER BY name`).all();
  },

  // ─── CUSTOMERS ────────────────────────────────────────────────────────────
  'customers:getAll': async ({ search } = {}) => {
    const db = getDb();
    if (search) return db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ?`).all(`%${search}%`, `%${search}%`);
    return db.prepare(`SELECT * FROM customers ORDER BY name`).all();
  },

  // ─── VENDORS ──────────────────────────────────────────────────────────────
  'vendors:getAll': async ({ search } = {}) => {
    const db = getDb();
    if (search) return db.prepare(`SELECT * FROM vendors WHERE vendor_name LIKE ? OR company_name LIKE ?`).all(`%${search}%`, `%${search}%`);
    return db.prepare(`SELECT * FROM vendors ORDER BY created_at DESC`).all();
  },

  'vendors:create': async (data) => {
    const r = getDb().prepare(`INSERT INTO vendors (vendor_name,company_name,email,phone,street_address,city,province_state,postal_code,account_name,account_number) VALUES (@vendor_name,@company_name,@email,@phone,@street_address,@city,@province_state,@postal_code,@account_name,@account_number)`).run(data);
    return { success: true, id: r.lastInsertRowid };
  },

  'vendors:update': async ({ id, ...data }) => {
    getDb().prepare(`UPDATE vendors SET vendor_name=?,company_name=?,email=?,phone=?,street_address=?,city=?,province_state=?,postal_code=?,account_name=?,account_number=? WHERE id=?`).run(data.vendor_name, data.company_name||'', data.email||'', data.phone||'', data.street_address||'', data.city||'', data.province_state||'', data.postal_code||'', data.account_name||'', data.account_number||'', id);
    return { success: true };
  },

  'vendors:delete': async ({ id }) => {
    getDb().prepare(`DELETE FROM vendors WHERE id = ?`).run(id);
    return { success: true };
  },

  // ─── PURCHASES ────────────────────────────────────────────────────────────
  'purchases:getAll': async ({ search } = {}) => {
    const db = getDb();
    let q = `SELECT pi.*, v.vendor_name, (SELECT COUNT(*) FROM purchase_invoice_items WHERE purchase_invoice_id=pi.id) as product_count, (SELECT COALESCE(SUM(qty),0) FROM purchase_invoice_items WHERE purchase_invoice_id=pi.id) as total_qty FROM purchase_invoices pi LEFT JOIN vendors v ON v.id = pi.vendor_id WHERE 1=1`;
    const params = [];
    if (search) { q += ` AND (pi.po_number LIKE ? OR v.vendor_name LIKE ?)`; const s = `%${search}%`; params.push(s, s); }
    q += ` ORDER BY pi.created_at DESC`;
    return db.prepare(q).all(...params);
  },

  'purchases:create': async (data) => {
    const db = getDb();
    const year = new Date().getFullYear();
    const last = db.prepare(`SELECT po_number FROM purchase_invoices ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.po_number.split('-')[2], 10); seq = isNaN(n) ? 1 : n + 1; }
    const po_number = `PO-${year}-${String(seq).padStart(6, '0')}`;
    const vendor = db.prepare(`SELECT vendor_name FROM vendors WHERE id = ?`).get(data.vendor_id);
    const vendorName = vendor?.vendor_name || data.vendor_name || '';
    const r = db.prepare(`INSERT INTO purchase_invoices (po_number,vendor_id,vendor_name,purchase_date,subtotal,grand_total,purchase_note,status,pending_amount) VALUES (?,?,?,?,?,?,?,?,?)`).run(po_number, data.vendor_id, vendorName, data.purchase_date, data.subtotal, data.grand_total, data.notes || '', data.status || 'Pending', data.grand_total);
    const piId = r.lastInsertRowid;
    if (data.items) {
      const ins = db.prepare(`INSERT INTO purchase_invoice_items (purchase_invoice_id,product_id,product_name,product_code,qty,price,total) VALUES (?,?,?,?,?,?,?)`);
      const upd = db.prepare(`UPDATE products SET current_stock = current_stock + ? WHERE id = ?`);
      for (const item of data.items) { ins.run(piId, item.product_id, item.name || item.product_name, item.sku || item.product_code || '', item.qty, item.rate || item.price, item.amount || item.total); if (data.status === 'Received') upd.run(item.qty, item.product_id); }
    }
    return { success: true, po_number, id: piId };
  },

  'purchases:delete': async ({ id }) => {
    const db = getDb();
    db.prepare(`DELETE FROM purchase_invoice_items WHERE purchase_invoice_id = ?`).run(id);
    db.prepare(`DELETE FROM purchase_invoices WHERE id = ?`).run(id);
    return { success: true };
  },

  'purchases:updateStatus': async ({ id, status }) => {
    const db = getDb();
    const pi = db.prepare(`SELECT status FROM purchase_invoices WHERE id = ?`).get(id);
    if (!pi) return { success: false, error: 'Not found' };
    db.prepare(`UPDATE purchase_invoices SET status = ? WHERE id = ?`).run(status, id);
    if (status === 'Received' && pi.status !== 'Received') {
      const items = db.prepare(`SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id = ?`).all(id);
      const updStock = db.prepare(`UPDATE products SET current_stock = current_stock + ?, status = CASE WHEN current_stock + ? <= 5 THEN 'Critical' WHEN current_stock + ? <= reorder_level THEN 'Low' ELSE 'Good' END WHERE id = ?`);
      for (const item of items) updStock.run(item.qty, item.qty, item.qty, item.product_id);
    }
    return { success: true };
  },

  'purchases:createReturn': async (data) => {
    const db = getDb();
    const r = db.prepare(`INSERT INTO purchase_returns (po_number,vendor_id,vendor_name,original_invoice_id,purchased_qty,return_qty,return_total,return_reason,status,order_date) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(data.po_number||'', data.vendor_id||null, data.vendor_name||'', data.original_invoice_id||null, data.purchased_qty||0, data.return_qty||0, data.return_total||0, data.return_reason||'', 'Pending', new Date().toISOString().slice(0,10));
    const returnId = r.lastInsertRowid;
    if (data.items && data.items.length) {
      const ins = db.prepare(`INSERT INTO purchase_return_items (purchase_return_id,product_id,item_name,sku,purchased_qty,return_qty,purchase_price,total) VALUES (?,?,?,?,?,?,?,?)`);
      const updStock = db.prepare(`UPDATE products SET current_stock = current_stock - ?, status = CASE WHEN current_stock - ? <= 5 THEN 'Critical' WHEN current_stock - ? <= reorder_level THEN 'Low' ELSE 'Good' END WHERE id=?`);
      for (const item of data.items) { if (item.return_qty > 0) { ins.run(returnId, item.product_id, item.item_name||'', item.sku||'', item.purchased_qty||0, item.return_qty, item.purchase_price||0, item.return_qty * (item.purchase_price||0)); updStock.run(item.return_qty, item.return_qty, item.return_qty, item.product_id); } }
    }
    return { success: true, id: returnId };
  },

  'purchases:getReturns': async () => {
    return getDb().prepare(`SELECT pr.*, v.vendor_name as vname FROM purchase_returns pr LEFT JOIN vendors v ON v.id=pr.vendor_id ORDER BY pr.order_date DESC`).all();
  },

  'purchases:getItems': async ({ id }) => {
    return getDb().prepare(`SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id = ?`).all(id);
  },

  // ─── PAY BILLS ────────────────────────────────────────────────────────────
  'paybills:getAll': async () => {
    return getDb().prepare(`SELECT pb.*, v.vendor_name FROM pay_bills pb LEFT JOIN vendors v ON v.id = pb.vendor_id ORDER BY pb.created_at DESC`).all();
  },

  'paybills:create': async (data) => {
    const db = getDb();
    const payingAmount = data.paying_amount || 0;
    const paymentDate = data.payment_date || data.last_payment_date || new Date().toISOString().slice(0, 10);
    db.prepare(`INSERT INTO pay_bills (vendor_id,purchase_invoice_id,outstanding_amount,total_payable,last_payment_date,payment_mode,due_date,paying_amount,payment_status) VALUES (?,?,?,?,?,?,?,?,?)`).run(data.vendor_id, data.purchase_invoice_id || null, data.outstanding_amount || 0, data.total_payable || payingAmount, paymentDate, data.payment_mode || 'Cash', data.due_date || null, payingAmount, 'Paid');
    if (data.purchase_invoice_id) db.prepare(`UPDATE purchase_invoices SET paid_amount = paid_amount + ?, pending_amount = pending_amount - ?, status = CASE WHEN paid_amount + ? >= grand_total THEN 'Received' ELSE 'Partial' END WHERE id = ?`).run(payingAmount, payingAmount, payingAmount, data.purchase_invoice_id);
    if (payingAmount > 0) {
      const year2p = new Date().getFullYear().toString().slice(-2);
      const lastTxnP = db.prepare(`SELECT txn_id FROM banking_transactions ORDER BY id DESC LIMIT 1`).get();
      let txnSeqP = 1;
      if (lastTxnP) { const n = parseInt(lastTxnP.txn_id.replace(`TXN-${year2p}`,''),10); txnSeqP = isNaN(n)?1:n+1; }
      const txn_id_p = `TXN-${year2p}${String(txnSeqP).padStart(3,'0')}`;
      const acctP = db.prepare(`SELECT id, account_name FROM accounts WHERE account_type='Cash' AND is_primary=1 LIMIT 1`).get() || db.prepare(`SELECT id, account_name FROM accounts WHERE account_type='Cash' LIMIT 1`).get();
      if (acctP) { db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`).run(txn_id_p, acctP.id, acctP.account_name, paymentDate, `Vendor Payment: ${data.vendor_id}`, 'Debit', payingAmount); db.prepare(`UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`).run(payingAmount, acctP.id); }
    }
    return { success: true };
  },

  // ─── BANKING ──────────────────────────────────────────────────────────────
  'banking:getAccounts': async () => {
    return getDb().prepare(`SELECT * FROM accounts WHERE account_type IN ('Cash','Bank') AND is_active = 1`).all();
  },

  'banking:getTransactions': async () => {
    return getDb().prepare(`SELECT * FROM banking_transactions ORDER BY date DESC LIMIT 50`).all();
  },

  'banking:addTransaction': async (data) => {
    const db = getDb();
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT txn_id FROM banking_transactions ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.txn_id.replace(`TXN-${year}`, ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const txn_id = `TXN-${year}${String(seq).padStart(3, '0')}`;
    db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`).run(txn_id, data.account_id, data.account_name, data.date, data.description, data.type, data.amount);
    const delta = data.type === 'Credit' ? data.amount : -data.amount;
    db.prepare(`UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`).run(delta, data.account_id);
    return { success: true, txn_id };
  },

  // ─── EXPENSES ─────────────────────────────────────────────────────────────
  'expenses:getAll': async () => {
    return getDb().prepare(`SELECT * FROM expenses ORDER BY expense_date DESC`).all();
  },

  'expenses:getStats': async () => {
    const db = getDb();
    const month = new Date().toISOString().slice(0, 7);
    const total = db.prepare(`SELECT COALESCE(SUM(amount),0) as val FROM expenses WHERE expense_date LIKE ?`).get(`${month}%`).val;
    const byCategory = db.prepare(`SELECT category, COALESCE(SUM(amount),0) as total FROM expenses WHERE expense_date LIKE ? GROUP BY category`).all(`${month}%`);
    return { total, byCategory };
  },

  'expenses:create': async (data) => {
    const db = getDb();
    const year = new Date().getFullYear().toString().slice(-2);
    const last = db.prepare(`SELECT expense_id FROM expenses ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt((last.expense_id || '').replace(`EXP-${year}`, ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const expense_id = `EXP-${year}${String(seq).padStart(3, '0')}`;
    db.prepare(`INSERT INTO expenses (expense_id,title,amount,expense_date,category,account_id,paid_from) VALUES (?,?,?,?,?,?,?)`).run(expense_id, data.title, data.amount, data.expense_date, data.category, data.account_id, data.paid_from);
    if (data.account_id) db.prepare(`UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?`).run(data.amount, data.account_id);
    if (data.account_id) {
      const year2e = new Date().getFullYear().toString().slice(-2);
      const lastTxnE = db.prepare(`SELECT txn_id FROM banking_transactions ORDER BY id DESC LIMIT 1`).get();
      let txnSeqE = 1;
      if (lastTxnE) { const n = parseInt(lastTxnE.txn_id.replace(`TXN-${year2e}`,''),10); txnSeqE = isNaN(n)?1:n+1; }
      const txn_id_e = `TXN-${year2e}${String(txnSeqE).padStart(3,'0')}`;
      const acctE = db.prepare(`SELECT account_name FROM accounts WHERE id=?`).get(data.account_id);
      db.prepare(`INSERT INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`).run(txn_id_e, data.account_id, acctE?.account_name||'', data.expense_date, `Expense: ${data.title}`, 'Debit', data.amount);
    }
    return { success: true, expense_id };
  },

  // ─── REPORTS ──────────────────────────────────────────────────────────────
  'reports:sales': async ({ from, to }) => {
    return getDb().prepare(`SELECT i.invoice_date as date, i.invoice_no as bill_no, i.customer_name, ii.product_name as item_name, ii.qty, ii.rate, ii.amount, i.status as payment_status, i.payment_mode, (ii.qty * (ii.rate - p.purchase_price)) as profit FROM invoices i JOIN invoice_items ii ON ii.invoice_id = i.id LEFT JOIN products p ON p.id = ii.product_id WHERE i.status != 'Draft' AND i.invoice_date BETWEEN ? AND ? ORDER BY i.invoice_date DESC`).all(from, to);
  },

  'reports:stock': async () => {
    return getDb().prepare(`SELECT p.name as item_name, c.name as category, p.opening_stock, COALESCE((SELECT SUM(qty) FROM purchase_invoice_items WHERE product_id = p.id),0) as purchase_qty, COALESCE((SELECT SUM(qty) FROM invoice_items WHERE product_id = p.id),0) as sales_qty, p.current_stock, p.purchase_price, p.selling_price, ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.selling_price,0)) * 100, 2) as profit_margin FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.is_active = 1`).all();
  },

  'reports:customerOutstanding': async () => {
    return getDb().prepare(`SELECT customer_name, invoice_no, invoice_date, grand_total as total_amount, paid_amount, (grand_total - paid_amount) as balance FROM invoices WHERE is_credit_sale = 1 AND status != 'Draft' ORDER BY invoice_date DESC`).all();
  },

  'reports:profitLoss': async ({ from, to }) => {
    return getDb().prepare(`SELECT ii.product_name as product, SUM(ii.qty) as units_sold, p.purchase_price as cost_price, p.selling_price as sales_price, SUM(ii.qty * (ii.rate - p.purchase_price)) as total_profit, ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.selling_price,0)) * 100, 2) as margin FROM invoice_items ii JOIN products p ON p.id = ii.product_id JOIN invoices i ON i.id = ii.invoice_id WHERE i.status != 'Draft' AND i.invoice_date BETWEEN ? AND ? GROUP BY ii.product_name ORDER BY total_profit DESC`).all(from, to);
  },

  'reports:balanceSheet': async () => {
    const db = getDb();
    const cashAccounts = db.prepare(`SELECT account_name, current_balance, is_primary FROM accounts WHERE account_type IN ('Cash','Bank') AND is_active=1`).all();
    const closingStock = db.prepare(`SELECT COALESCE(SUM(current_stock*purchase_price),0) as val FROM products WHERE is_active=1`).get().val;
    const customerOutstanding = db.prepare(`SELECT COALESCE(SUM(grand_total-paid_amount),0) as val FROM invoices WHERE is_credit_sale=1`).get().val;
    const vendorOutstanding = db.prepare(`SELECT COALESCE(SUM(grand_total-paid_amount),0) as val FROM purchase_invoices WHERE status != 'Received'`).get().val;
    const ownerCapital = db.prepare(`SELECT COALESCE(SUM(opening_balance),0) as val FROM accounts WHERE account_type='Capital'`).get().val;
    const totalRevenue = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM invoices WHERE status!='Draft'`).get().val;
    const totalCost = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM purchase_invoices WHERE status!='Pending'`).get().val;
    const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as val FROM expenses`).get().val;
    const retainedEarnings = totalRevenue - totalCost - totalExpenses;
    return { cashAccounts, closingStock, customerOutstanding, vendorOutstanding, ownerCapital, retainedEarnings };
  },

  'reports:expenses': async ({ from, to, branch_id, category } = {}) => {
    const db = getDb();
    let q = `SELECT e.expense_id, e.title, e.category, e.amount, e.expense_date, e.paid_from, b.name as branch_name FROM expenses e LEFT JOIN branches b ON b.id = e.branch_id WHERE 1=1`;
    const params = [];
    if (from && to) { q += ` AND e.expense_date BETWEEN ? AND ?`; params.push(from, to); }
    if (branch_id) { q += ` AND e.branch_id = ?`; params.push(branch_id); }
    if (category && category !== 'All') { q += ` AND e.category = ?`; params.push(category); }
    q += ` ORDER BY e.expense_date DESC`;
    const rows = db.prepare(q).all(...params);
    const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
    return { rows, total };
  },

  // ─── SEARCH ───────────────────────────────────────────────────────────────
  'search:global': async ({ query }) => {
    const db = getDb();
    const q = `%${query}%`;
    const invoices = db.prepare(`SELECT 'invoice' as type, id, invoice_no, customer_name, grand_total, status, invoice_date as date FROM invoices WHERE invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? LIMIT 5`).all(q, q, q);
    const products = db.prepare(`SELECT 'product' as type, id, sku, name, current_stock, selling_price, status FROM products WHERE name LIKE ? OR sku LIKE ? OR barcode LIKE ? AND is_active=1 LIMIT 5`).all(q, q, q);
    const vendors = db.prepare(`SELECT 'vendor' as type, id, vendor_name as name, company_name, phone FROM vendors WHERE vendor_name LIKE ? OR company_name LIKE ? LIMIT 3`).all(q, q);
    const users = db.prepare(`SELECT 'user' as type, id, name, mobile, role, is_active FROM users WHERE name LIKE ? OR mobile LIKE ? LIMIT 3`).all(q, q);
    const expenses = db.prepare(`SELECT 'expense' as type, id, expense_id, title as name, amount, expense_date as date FROM expenses WHERE title LIKE ? OR expense_id LIKE ? LIMIT 3`).all(q, q);
    return { invoices, products, vendors, users, expenses };
  },

  // ─── SETTINGS ─────────────────────────────────────────────────────────────
  'settings:getCompany': async () => getDb().prepare(`SELECT * FROM company_profile WHERE id=1`).get(),

  'settings:saveCompany': async (data) => {
    getDb().prepare(`UPDATE company_profile SET company_name=?,mobile=?,email=?,address=?,logo_path=COALESCE(?,logo_path) WHERE id=1`).run(data.company_name, data.mobile, data.email, data.address, data.logo_path || null);
    return { success: true };
  },

  'settings:getAll': async () => {
    const rows = getDb().prepare(`SELECT key, value FROM app_settings`).all();
    return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
  },

  'settings:saveAll': async (data) => {
    const db = getDb();
    const ups = db.prepare(`INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`);
    for (const [key, value] of Object.entries(data)) ups.run(key, String(value));
    return { success: true };
  },

  'settings:clearData': async ({ modules } = {}) => {
    const db = getDb();
    const cleared = [];
    const errors = [];
    const clearAll = db.transaction((mods) => {
      for (const mod of mods) {
        const tables = CLEAR_TABLES[mod];
        if (!tables || tables.length === 0) continue;
        for (const tbl of tables) { try { db.prepare(`DELETE FROM ${tbl}`).run(); cleared.push(tbl); } catch (e) { errors.push(`${tbl}: ${e.message}`); } }
      }
    });
    clearAll(modules || []);
    if (cleared.length > 0) db.prepare(`INSERT INTO backups (type,date_time,size_mb,status) VALUES (?,?,0.0,'Success')`).run(`Data Cleared (${modules.join(', ')})`, new Date().toISOString());
    return { success: errors.length === 0, cleared, errors };
  },

  'settings:getTableCounts': async () => {
    const db = getDb();
    return { billing: db.prepare(`SELECT COUNT(*) as c FROM invoices`).get().c, inventory: db.prepare(`SELECT COUNT(*) as c FROM products`).get().c, vendors: db.prepare(`SELECT COUNT(*) as c FROM vendors`).get().c, banking: db.prepare(`SELECT COUNT(*) as c FROM banking_transactions`).get().c, expenses: db.prepare(`SELECT COUNT(*) as c FROM expenses`).get().c, notifications: db.prepare(`SELECT COUNT(*) as c FROM notifications`).get().c };
  },

  // ─── ACCOUNTS ─────────────────────────────────────────────────────────────
  'accounts:getAll': async () => getDb().prepare(`SELECT * FROM accounts ORDER BY created_at`).all(),

  'accounts:create': async (data) => {
    getDb().prepare(`INSERT INTO accounts (account_name,account_type,opening_balance,current_balance,as_of_date) VALUES (?,?,?,?,?)`).run(data.account_name, data.account_type, data.opening_balance, data.opening_balance, data.as_of_date);
    return { success: true };
  },

  'accounts:update': async ({ id, ...data }) => {
    getDb().prepare(`UPDATE accounts SET account_name=?,account_type=?,opening_balance=? WHERE id=?`).run(data.account_name, data.account_type, data.opening_balance, id);
    return { success: true };
  },

  // ─── USERS ────────────────────────────────────────────────────────────────
  'users:getAll': async () => {
    return getDb().prepare(`SELECT id,name,mobile,email,role,branch_id,is_active,avatar_path,created_at FROM users ORDER BY created_at`).all();
  },

  'users:create': async (data) => {
    const hash = bcrypt.hashSync(data.password, 10);
    getDb().prepare(`INSERT INTO users (name,mobile,email,password,role,branch_id) VALUES (?,?,?,?,?,?)`).run(data.name, data.mobile, data.email, hash, data.role, data.branch_id||null);
    return { success: true };
  },

  'users:update': async ({ id, ...data }) => {
    const db = getDb();
    if (data.password) {
      const hash = bcrypt.hashSync(data.password, 10);
      db.prepare(`UPDATE users SET name=?,mobile=?,email=?,role=?,branch_id=?,password=? WHERE id=?`).run(data.name, data.mobile, data.email, data.role, data.branch_id||null, hash, id);
    } else {
      db.prepare(`UPDATE users SET name=?,mobile=?,email=?,role=?,branch_id=? WHERE id=?`).run(data.name, data.mobile, data.email, data.role, data.branch_id||null, id);
    }
    return { success: true };
  },

  'users:toggleActive': async ({ id, is_active }) => {
    getDb().prepare(`UPDATE users SET is_active=? WHERE id=?`).run(is_active, id);
    return { success: true };
  },

  'users:delete': async ({ id }) => {
    getDb().prepare(`DELETE FROM users WHERE id=?`).run(id);
    return { success: true };
  },

  // ─── BRANCHES ─────────────────────────────────────────────────────────────
  'branches:getAll': async () => getDb().prepare(`SELECT * FROM branches WHERE is_active=1 ORDER BY id`).all(),

  'branches:create': async (data) => {
    const r = getDb().prepare(`INSERT INTO branches (name, code, address, contact, is_active) VALUES (?,?,?,?,1)`).run(data.name, data.code||'', data.address||'', data.contact||'');
    return { success: true, id: r.lastInsertRowid };
  },

  'branches:update': async ({ id, ...data }) => {
    getDb().prepare(`UPDATE branches SET name=?,code=?,address=?,contact=? WHERE id=?`).run(data.name, data.code||'', data.address||'', data.contact||'', id);
    return { success: true };
  },

  'branches:delete': async ({ id }) => {
    const db = getDb();
    const hasInvoices = db.prepare(`SELECT id FROM invoices WHERE branch_id=? LIMIT 1`).get(id);
    if (hasInvoices) return { success: false, error: 'Branch has linked invoices and cannot be deleted.' };
    db.prepare(`UPDATE branches SET is_active=0 WHERE id=?`).run(id);
    return { success: true };
  },

  // ─── BACKUP ───────────────────────────────────────────────────────────────
  'backup:getLogs': async () => getDb().prepare(`SELECT * FROM backups ORDER BY id DESC LIMIT 20`).all(),

  'backup:now': async () => {
    getDb().prepare(`INSERT INTO backups (type,date_time,size_mb,status) VALUES ('Manual Backup (Admin)',?,0.0,'Success')`).run(new Date().toISOString());
    return { success: true };
  },

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────────
  'notifications:getAll': async () => {
    const db = getDb();
    generateNotifications(db);
    const notifications = db.prepare(`SELECT * FROM notifications ORDER BY is_read ASC, created_at DESC LIMIT 50`).all();
    const unread = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE is_read=0`).get().count;
    return { notifications, unread };
  },

  'notifications:markRead': async ({ id } = {}) => {
    const db = getDb();
    if (id) db.prepare(`UPDATE notifications SET is_read=1 WHERE id=?`).run(id);
    else db.prepare(`UPDATE notifications SET is_read=1`).run();
    return { success: true };
  },

  'notifications:delete': async ({ id } = {}) => {
    const db = getDb();
    if (id) db.prepare(`DELETE FROM notifications WHERE id=?`).run(id);
    else db.prepare(`DELETE FROM notifications WHERE is_read=1`).run();
    return { success: true };
  },

  'notifications:add': async ({ type, title, message, link } = {}) => {
    const r = getDb().prepare(`INSERT INTO notifications (type,title,message,link) VALUES (?,?,?,?)`).run(type, title, message, link || null);
    return { success: true, id: r.lastInsertRowid };
  },

  // ─── INVOICE DESIGNER ─────────────────────────────────────────────────────
  'invoiceSettings:get': async () => {
    const db = getDb();
    let row = db.prepare(`SELECT * FROM invoice_settings WHERE id = 1`).get();
    if (!row) { db.prepare(`INSERT INTO invoice_settings (id) VALUES (1)`).run(); row = db.prepare(`SELECT * FROM invoice_settings WHERE id = 1`).get(); }
    return { ...row, custom_fields: JSON.parse(row.custom_fields || '[]') };
  },

  'invoiceSettings:save': async (data) => {
    const db = getDb();
    const payload = { ...data, custom_fields: JSON.stringify(data.custom_fields || []) };
    const exists = db.prepare(`SELECT id FROM invoice_settings WHERE id = 1`).get();
    if (exists) {
      const cols = Object.keys(payload).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
      const vals = Object.keys(payload).filter(k => k !== 'id').map(k => payload[k]);
      db.prepare(`UPDATE invoice_settings SET ${cols} WHERE id = 1`).run(...vals);
    } else {
      db.prepare(`INSERT INTO invoice_settings (id) VALUES (1)`).run();
      const cols = Object.keys(payload).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ');
      const vals = Object.keys(payload).filter(k => k !== 'id').map(k => payload[k]);
      db.prepare(`UPDATE invoice_settings SET ${cols} WHERE id = 1`).run(...vals);
    }
    return { success: true };
  },

};
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
node --check server/handlers.js
```

Expected: no output.

- [ ] **Step 3: Verify handler count and key channels**

```bash
node -e "
const { initDb } = require('./server/database');
initDb();
const h = require('./server/handlers');
const keys = Object.keys(h);
console.log('Total handlers:', keys.length);
['auth:login','invoices:getAll','dashboard:getStats','products:getAll',
 'vendors:getAll','reports:sales','search:global','notifications:getAll',
 'invoiceSettings:get','settings:clearData'].forEach(k =>
  console.log(k + ':', keys.includes(k) ? 'OK' : 'MISSING'));
console.log('chooseLogoFile (must be false):', keys.includes('settings:chooseLogoFile'));
console.log('restoreBackup (must be false):', keys.includes('settings:restoreBackup'));
"
```

Expected: all 10 named channels print `OK`, both exclusion checks print `false`.

- [ ] **Step 4: Run a live DB query through the handler**

```bash
node -e "
const { initDb } = require('./server/database');
initDb();
const h = require('./server/handlers');
h['auth:getRoles']().then(r => { console.log('Roles:', r); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
"
```

Expected: prints array of role names.

- [ ] **Step 5: Commit**

```bash
git add server/handlers.js
git commit -m "feat: add server/handlers.js — complete DB handler extraction from ipcHandlers"
```

---

### Task 4: Create server/index.js

**Files:**
- Create: `server/index.js`

The Express app. Single `POST /api` dispatcher + `GET /health` for readiness polling. Two shutdown guards so the server never orphans on Windows.

- [ ] **Step 1: Create server/index.js**

```js
const express = require('express');
const cors = require('cors');
const { initDb } = require('./database');
const handlers = require('./handlers');

const app = express();

// Allow both localhost:3000 (React dev server) and null/file:// (packaged Electron)
app.use(cors({ origin: (origin, cb) => cb(null, true) }));
app.use(express.json());

// Readiness endpoint — main.js polls this before opening the window
app.get('/health', (_, res) => res.json({ ok: true }));

// Single dispatcher — all DB/business channels route here
app.post('/api', async (req, res) => {
  const { channel, data } = req.body;
  const handler = handlers[channel];
  if (!handler) {
    return res.status(404).json({ error: `Unknown channel: ${channel}` });
  }
  try {
    const result = await handler(data || {});
    res.json({ result });
  } catch (err) {
    console.error(`[${channel}]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Initialize DB and start listening
initDb();
app.listen(3001, '127.0.0.1', () => {
  console.log('[server] Ready on http://127.0.0.1:3001');
});

// Shutdown guard 1: Electron closes stdin pipe on normal exit
process.stdin.resume();
process.stdin.on('end', () => {
  console.log('[server] stdin closed — exiting');
  process.exit(0);
});

// Shutdown guard 2: parent PID watchdog — handles Electron crash on Windows
// process.kill(pid, 0) throws if the process is gone
const parentPid = process.ppid;
setInterval(() => {
  try {
    process.kill(parentPid, 0);
  } catch {
    console.log('[server] Parent process gone — exiting');
    process.exit(0);
  }
}, 5000);
```

- [ ] **Step 2: Start the server standalone and verify /health**

In one terminal:
```bash
node server/index.js
```

Expected output:
```
[server] Ready on http://127.0.0.1:3001
```

In a second terminal:
```bash
node -e "fetch('http://127.0.0.1:3001/health').then(r=>r.json()).then(console.log)"
```

Expected: `{ ok: true }`

- [ ] **Step 3: Test the /api endpoint with a real channel**

```bash
node -e "
fetch('http://127.0.0.1:3001/api', {
  method: 'POST',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ channel: 'auth:getRoles', data: {} })
}).then(r=>r.json()).then(j => console.log('result:', j.result))
"
```

Expected: `result: [ 'Billing Operator', 'Owner', ... ]` (array of role strings)

Stop the server (Ctrl+C) before proceeding.

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: add server/index.js — Express dispatcher with health check and shutdown guards"
```

---

### Task 5: Create src/main/electronHandlers.js

**Files:**
- Create: `src/main/electronHandlers.js`
- Reference: `src/main/ipcHandlers.js` lines 686–759 (the 6 Electron-only handlers)

These 6 handlers use `dialog` and `fs` — Electron-only APIs. They stay in the main process.

- [ ] **Step 1: Create src/main/electronHandlers.js**

Copy the exact bodies of the 6 handlers from `ipcHandlers.js`, wrapped in a registration function:

```js
const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');

module.exports = function registerElectronHandlers() {

  ipcMain.handle('settings:chooseLogoFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('settings:chooseRestoreFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite DB', extensions: ['db', 'sqlite'] }]
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('settings:uploadLogo', async (_, { filePath }) => {
    const dest = path.join(app.getPath('userData'), 'company_logo' + path.extname(filePath));
    fs.copyFileSync(filePath, dest);
    // File is copied. The renderer is responsible for calling
    // window.electron.invoke('settings:saveCompany', { logo_path: dest })
    // to persist the path to the DB (that call routes to the Express server).
    return { success: true, logo_path: dest };
  });

  ipcMain.handle('settings:restoreBackup', async (_, { filePath }) => {
    const dest = path.join(app.getPath('userData'), 'invoicing.db');
    fs.copyFileSync(filePath, dest);
    return { success: true };
  });

  ipcMain.handle('products:chooseImportFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV/Excel', extensions: ['csv', 'xlsx', 'xls'] }]
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('products:chooseSaveFile', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'products.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled) return null;
    return result.filePath;
  });

};
```

> **Note on `settings:uploadLogo`:** The original handler also called `getDb().prepare(...).run(dest)` to update `company_profile.logo_path`. Since `getDb` is no longer available in the main process, this DB write should be moved to the renderer: after the logo file is chosen and copied, the renderer calls `window.electron.invoke('settings:saveCompany', { logo_path: dest })` — which routes to the Express server. Check `Settings.jsx` to confirm the renderer already does this, or add the call there.

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
node -e "const r = require('./src/main/electronHandlers'); console.log(typeof r);"
```

Expected: `function`

(This runs in Node.js not Electron, so it will throw when it tries to `require('electron')` — that's expected. The `typeof` check runs before the require, confirming parse is valid. Alternatively just: `node --check src/main/electronHandlers.js`)

```bash
node --check src/main/electronHandlers.js
```

Expected: no output (means no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add src/main/electronHandlers.js
git commit -m "feat: add electronHandlers.js with 6 Electron-only dialog/fs handlers"
```

---

### Task 6: Rewrite src/main/preload.js

**Files:**
- Modify: `src/main/preload.js`

The preload becomes a dual-path adapter. Channels in `ELECTRON_CHANNELS` route to native IPC (for the 6 dialog handlers). Everything else goes via `fetch()` to the Express server.

- [ ] **Step 1: Replace the entire content of src/main/preload.js**

```js
const { contextBridge, ipcRenderer } = require('electron');

// These 6 channels use Electron APIs (dialog, fs) — they stay as native IPC.
// All other channels go via HTTP to the Express server on port 3001.
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
      // Native IPC path — handled by electronHandlers.js in main process
      return ipcRenderer.invoke(channel, data);
    }

    // HTTP path — routed to Express server
    const res = await fetch('http://127.0.0.1:3001/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, data: data || {} }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.result;
  },

  // Preserved for API surface completeness (not currently used by any renderer page)
  on: (channel, cb) => ipcRenderer.on(channel, (_, ...args) => cb(...args)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
```

- [ ] **Step 2: Verify syntax**

```bash
node --check src/main/preload.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/main/preload.js
git commit -m "feat: rewrite preload.js as dual-path HTTP/IPC adapter"
```

---

### Task 7: Rewrite src/main/main.js

**Files:**
- Modify: `src/main/main.js`

Main.js becomes a thin orchestrator: spawn server → poll `/health` → open window → kill server on close. No more `database.js` or `ipcHandlers.js` imports.

- [ ] **Step 1: Replace the entire content of src/main/main.js**

```js
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

const isDev = process.env.NODE_ENV !== 'production';
let mainWindow;
let serverProcess;

// ─── Server lifecycle ────────────────────────────────────────────────────────

function startServer() {
  const serverPath = isDev
    ? path.join(__dirname, '../../server/index.js')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js');

  serverProcess = spawn('node', [serverPath], {
    // 'pipe' for stdin so server detects parent exit via stdin EOF guard
    stdio: ['pipe', isDev ? 'inherit' : 'ignore', isDev ? 'inherit' : 'ignore'],
    detached: false,
  });

  serverProcess.on('error', (err) => {
    console.error('[main] Failed to start server:', err.message);
  });
}

async function waitForServer(maxMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://127.0.0.1:3001/health');
      if (res.ok) return; // Server is ready
    } catch {
      // Not ready yet — keep polling
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('[main] Express server did not start within 10 seconds');
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    show: false,
    titleBarStyle: 'default',
  });

  const startURL = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../build/index.html')}`;

  mainWindow.loadURL(startURL);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (isDev) mainWindow.webContents.openDevTools();
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Register the 6 Electron-only IPC handlers (dialog, fs)
  require('./electronHandlers')();

  // Start Express server and wait until it is accepting connections
  startServer();
  await waitForServer();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 2: Verify syntax**

```bash
node --check src/main/main.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/main/main.js
git commit -m "feat: rewrite main.js to spawn Express server with health-check polling"
```

---

### Task 8: Delete the old Electron DB files

**Files:**
- Delete: `src/main/database.js`
- Delete: `src/main/ipcHandlers.js`

These files are now replaced by `server/database.js`, `server/handlers.js`, and `src/main/electronHandlers.js`. Keeping them would cause confusion.

- [ ] **Step 1: Delete the files**

```bash
git rm src/main/database.js src/main/ipcHandlers.js
```

- [ ] **Step 2: Confirm no remaining references to these files in main process**

```bash
node -e "
const fs = require('fs');
const main = fs.readFileSync('src/main/main.js', 'utf8');
console.log('database.js ref:', main.includes('database'));
console.log('ipcHandlers ref:', main.includes('ipcHandlers'));
"
```

Expected:
```
database.js ref: false
ipcHandlers ref: false
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove src/main/database.js and ipcHandlers.js (moved to server/)"
```

---

### Task 9: Full smoke test — verify the app works end-to-end

This task has no code changes. Run `npm start` and manually verify the critical paths across all modules.

- [ ] **Step 1: Start the app**

```bash
npm start
```

Watch the terminal. Expected sequence:
```
[server] Ready on http://127.0.0.1:3001    ← Express started
(React dev server starts on :3000)
(Electron window opens)
```

If you see `Express server did not start within 10 seconds`, the server crashed. Check the server error logs visible in the terminal.

- [ ] **Step 2: Login**

Select any role from the dropdown (e.g. Owner → admin). Enter password `admin123`. Expected: lands on Dashboard with stat cards showing numbers.

If login hangs or shows an error, open DevTools (F12 → Console) and look for `fetch` errors — this means the preload is not reaching `localhost:3001`.

- [ ] **Step 3: Test Dashboard loads**

Verify: stat cards show values (Total Sale, Profit, etc.), monthly sales chart renders, Recent Invoices table has rows.

- [ ] **Step 4: Test Billing & Invoice**

Navigate to Billing & Invoice. Verify: invoice list loads. Click any invoice — verify the detail/view loads.

- [ ] **Step 5: Test Inventory**

Navigate to Inventory. Verify: product list loads with stock levels.

- [ ] **Step 6: Test Vendors & Purchases**

Navigate to Vendors. Verify: vendor list and purchase orders load.

- [ ] **Step 7: Test Banking**

Navigate to Banking. Verify: accounts and transactions load.

- [ ] **Step 8: Test Reports**

Navigate to Reports. Select Sales report with a date range. Verify: table populates.

- [ ] **Step 9: Test Settings — company info (DB channel)**

Navigate to Settings → Company. Verify: company name and address load from DB.

- [ ] **Step 10: Test Settings — file dialog (Electron-only channel)**

In Settings, click the logo upload button. Verify: native OS file picker dialog opens (this confirms the `ELECTRON_CHANNELS` routing in preload.js is working). Select any image file and confirm it is accepted. If the logo persists after Settings reload, the `settings:saveCompany` DB write via the Express server is also working correctly. If it does not persist, open `Settings.jsx`, find the logo upload handler, and confirm it calls `window.electron.invoke('settings:saveCompany', { ..., logo_path: dest })` after the upload — add that call if missing.

- [ ] **Step 11: Test global search**

Press `Ctrl+K`. Type a product name. Verify: search results appear (confirms `search:global` HTTP routing works).

- [ ] **Step 12: Close the app**

Close the Electron window. Verify: no `node.exe` or `server` process remains running in Task Manager. If a process lingers, the shutdown guard in `server/index.js` needs checking.

- [ ] **Step 13: Final commit**

```bash
git add -A
git commit -m "feat: complete Electron → Express server migration — better-sqlite3 C++ error eliminated"
```

---

## What Changed — Summary

| Before | After |
|--------|-------|
| `better-sqlite3` compiled for Electron ABI → `node-gyp` error | Compiled for system Node.js v22 → `npm install` works |
| `src/main/database.js` — Electron main process | `server/database.js` — plain Node.js |
| `src/main/ipcHandlers.js` — 50+ IPC handlers | `server/handlers.js` — same logic, HTTP dispatch |
| `src/main/preload.js` — pure IPC bridge | `src/main/preload.js` — dual-path: HTTP + IPC |
| `src/main/main.js` — imports DB + handlers directly | `src/main/main.js` — spawns Express child process |
| All React pages | **Unchanged** — `window.electron.invoke()` still works |

## Switching to Railway Later

When ready to move the server to Railway:
1. Deploy `server/` to Railway (or copy the repo — it's a plain Express+SQLite app)
2. In `src/main/preload.js`, change one constant:
   ```js
   // Replace:
   const res = await fetch('http://127.0.0.1:3001/api', ...
   // With:
   const res = await fetch('https://your-app.railway.app/api', ...
   ```
3. Remove `startServer()` and `waitForServer()` calls from `src/main/main.js`
4. No React page changes needed

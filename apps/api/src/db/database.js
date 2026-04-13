const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = (process.env.DB_PATH || '').trim() ||
  (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'invoicing.db')
    : path.join(process.cwd(), 'invoicing.db'));

let db;
const FORCE_SEED = process.env.FORCE_SEED === 'true';

// BUG FIX #1: was named `initialize` but index.js called `initDb` — DB never started
function initDb() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  seedDefaultData();
  console.log('Database initialized at:', DB_PATH);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function getDbPath() {
  return DB_PATH;
}

function createTables() {
  db.exec(`
    -- BUG FIX #9a: company_profile expanded to match company.js route columns
    CREATE TABLE IF NOT EXISTS company_profile (
      id               INTEGER PRIMARY KEY,
      company_name     TEXT NOT NULL DEFAULT 'My Company',
      tagline          TEXT DEFAULT '',
      mobile           TEXT DEFAULT '',
      email            TEXT DEFAULT '',
      address          TEXT DEFAULT '',
      city             TEXT DEFAULT '',
      state            TEXT DEFAULT '',
      pincode          TEXT DEFAULT '',
      website          TEXT DEFAULT '',
      gstin            TEXT DEFAULT '',
      pan              TEXT DEFAULT '',
      bank_name        TEXT DEFAULT '',
      account_number   TEXT DEFAULT '',
      ifsc_code        TEXT DEFAULT '',
      upi_id           TEXT DEFAULT '',
      invoice_prefix   TEXT DEFAULT 'INV',
      invoice_footer   TEXT DEFAULT '',
      currency_symbol  TEXT DEFAULT 'Rs.',
      tax_label        TEXT DEFAULT 'GST',
      tax_percent      REAL DEFAULT 18,
      logo_path        TEXT
    );

    -- BUG FIX #9b: branches expanded to match branches.js route columns
    CREATE TABLE IF NOT EXISTS branches (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      store_id  TEXT UNIQUE,
      address   TEXT DEFAULT '',
      city      TEXT DEFAULT '',
      state     TEXT DEFAULT '',
      phone     TEXT DEFAULT '',
      email     TEXT DEFAULT '',
      gstin     TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      UNIQUE(module, action)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role          TEXT NOT NULL,
      permission_id INTEGER REFERENCES permissions(id),
      granted       INTEGER DEFAULT 1,
      UNIQUE(role, permission_id)
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      is_system  INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      mobile     TEXT UNIQUE,
      email      TEXT,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'Staff',
      branch_id  INTEGER REFERENCES branches(id),
      is_active  INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_permissions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
      module     TEXT NOT NULL,
      can_view   INTEGER DEFAULT 0,
      can_create INTEGER DEFAULT 0,
      can_edit   INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      UNIQUE(user_id, module)
    );

    -- BUG FIX #9c: customers expanded to match customers.js columns + added is_active
    CREATE TABLE IF NOT EXISTS customers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      mobile          TEXT,
      email           TEXT,
      address         TEXT DEFAULT '',
      city            TEXT DEFAULT '',
      state           TEXT DEFAULT '',
      pincode         TEXT DEFAULT '',
      gstin           TEXT,
      customer_type   TEXT DEFAULT 'Regular',
      opening_balance REAL DEFAULT 0,
      credit_limit    REAL DEFAULT 0,
      credit_days     INTEGER DEFAULT 30,
      is_active       INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active   INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      sku            TEXT UNIQUE,
      barcode        TEXT UNIQUE,
      category_id    INTEGER REFERENCES categories(id),
      purchase_price REAL DEFAULT 0,
      selling_price  REAL DEFAULT 0,
      current_stock  INTEGER DEFAULT 0,
      reorder_level  INTEGER DEFAULT 10,
      opening_stock  INTEGER DEFAULT 0,
      status         TEXT DEFAULT 'Good',
      description    TEXT,
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no      TEXT UNIQUE NOT NULL,
      invoice_date    TEXT NOT NULL,
      due_date        TEXT,
      customer_name   TEXT,
      customer_phone  TEXT,
      customer_address TEXT,
      seller_id       INTEGER REFERENCES users(id),
      branch_id       INTEGER REFERENCES branches(id),
      subtotal        REAL DEFAULT 0,
      tax_amount      REAL DEFAULT 0,
      grand_total     REAL DEFAULT 0,
      payment_mode    TEXT DEFAULT 'Cash',
      cash_amount     REAL,
      online_amount   REAL,
      internal_notes  TEXT,
      status          TEXT DEFAULT 'Paid',
      type            TEXT DEFAULT 'Sale',
      is_credit_sale  INTEGER DEFAULT 0,
      paid_amount     REAL DEFAULT 0,
      created_by      INTEGER REFERENCES users(id),
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id   INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      product_id   INTEGER REFERENCES products(id),
      product_code TEXT,
      product_name TEXT,
      qty          INTEGER DEFAULT 1,
      rate         REAL DEFAULT 0,
      amount       REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS return_exchange (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      original_invoice_id INTEGER REFERENCES invoices(id),
      invoice_no          TEXT,
      customer_name       TEXT,
      type                TEXT NOT NULL,
      total_items_sold    INTEGER,
      items_returned      INTEGER DEFAULT 0,
      return_amount       REAL DEFAULT 0,
      exchange_amount     REAL DEFAULT 0,
      net_amount          REAL DEFAULT 0,
      status              TEXT DEFAULT 'complete',
      created_by          INTEGER REFERENCES users(id),
      date                TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS return_exchange_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id    INTEGER REFERENCES return_exchange(id) ON DELETE CASCADE,
      product_id   INTEGER REFERENCES products(id),
      product_name TEXT,
      returned_qty INTEGER DEFAULT 0,
      exchange_qty INTEGER DEFAULT 0,
      rate         REAL
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_name         TEXT NOT NULL,
      company_name        TEXT,
      email               TEXT,
      phone               TEXT,
      street_address      TEXT,
      city                TEXT,
      province_state      TEXT,
      postal_code         TEXT,
      account_name        TEXT,
      account_number      TEXT,
      outstanding_balance REAL DEFAULT 0,
      status              TEXT DEFAULT 'Active',
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number      TEXT UNIQUE NOT NULL,
      vendor_id      INTEGER REFERENCES vendors(id),
      vendor_name    TEXT,
      purchase_date  TEXT,
      subtotal       REAL DEFAULT 0,
      grand_total    REAL DEFAULT 0,
      paid_amount    REAL DEFAULT 0,
      pending_amount REAL DEFAULT 0,
      purchase_note  TEXT,
      status         TEXT DEFAULT 'Pending',
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      product_id          INTEGER REFERENCES products(id),
      product_name        TEXT,
      product_code        TEXT,
      qty                 INTEGER DEFAULT 0,
      price               REAL DEFAULT 0,
      total               REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_returns (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number           TEXT,
      vendor_id           INTEGER REFERENCES vendors(id),
      vendor_name         TEXT,
      original_invoice_id INTEGER REFERENCES purchase_invoices(id),
      purchased_qty       INTEGER DEFAULT 0,
      return_qty          INTEGER DEFAULT 0,
      return_total        REAL DEFAULT 0,
      return_reason       TEXT,
      status              TEXT DEFAULT 'Pending',
      order_date          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_return_items (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_return_id INTEGER REFERENCES purchase_returns(id) ON DELETE CASCADE,
      product_id         INTEGER REFERENCES products(id),
      item_name          TEXT,
      sku                TEXT,
      purchased_qty      INTEGER DEFAULT 0,
      return_qty         INTEGER DEFAULT 0,
      purchase_price     REAL DEFAULT 0,
      total              REAL DEFAULT 0
    );

    -- BUG FIX #9d: pay_bills schema aligned with paybills.js route (simplified columns)
    CREATE TABLE IF NOT EXISTS pay_bills (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id           INTEGER REFERENCES vendors(id),
      purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
      amount              REAL DEFAULT 0,
      payment_mode        TEXT DEFAULT 'Cash',
      payment_date        TEXT,
      reference_no        TEXT,
      notes               TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name    TEXT NOT NULL,
      account_type    TEXT DEFAULT 'Cash',
      bank_name       TEXT,
      account_number  TEXT,
      ifsc_code       TEXT,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      is_primary      INTEGER DEFAULT 0,
      is_active       INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS banking_transactions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      txn_id       TEXT UNIQUE,
      account_id   INTEGER REFERENCES accounts(id),
      account_name TEXT,
      date         TEXT,
      description  TEXT,
      type         TEXT,
      amount       REAL DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id   INTEGER REFERENCES expense_categories(id),
      category_name TEXT,
      amount        REAL DEFAULT 0,
      payment_mode  TEXT DEFAULT 'Cash',
      description   TEXT,
      expense_date  TEXT,
      created_by    INTEGER REFERENCES users(id),
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backups (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      filename   TEXT,
      size       INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      notes      TEXT
    );

    -- BUG FIX #9e: notifications expanded with user_id, reference_id, reference_type columns
    CREATE TABLE IF NOT EXISTS notifications (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      type           TEXT,
      title          TEXT,
      message        TEXT,
      user_id        INTEGER REFERENCES users(id),
      reference_id   INTEGER,
      reference_type TEXT,
      link           TEXT,
      is_read        INTEGER DEFAULT 0,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_settings (
      id                   INTEGER PRIMARY KEY DEFAULT 1,
      inv_prefix           TEXT DEFAULT 'INV',
      inv_suffix           TEXT DEFAULT '',
      inv_start_number     INTEGER DEFAULT 1,
      inv_padding          INTEGER DEFAULT 3,
      seller_name          TEXT DEFAULT '',
      seller_tagline       TEXT DEFAULT '',
      seller_phone         TEXT DEFAULT '',
      seller_email         TEXT DEFAULT '',
      seller_website       TEXT DEFAULT '',
      seller_gstin         TEXT DEFAULT '',
      seller_pan           TEXT DEFAULT '',
      seller_address       TEXT DEFAULT '',
      template_color       TEXT DEFAULT '#111111',
      template_layout      TEXT DEFAULT 'Classic',
      show_customer_info   INTEGER DEFAULT 1,
      show_due_date        INTEGER DEFAULT 1,
      show_hsn             INTEGER DEFAULT 1,
      show_tax_breakdown   INTEGER DEFAULT 1,
      show_bank_details    INTEGER DEFAULT 1,
      show_signature       INTEGER DEFAULT 1,
      show_terms           INTEGER DEFAULT 1,
      show_logo            INTEGER DEFAULT 1,
      show_watermark       INTEGER DEFAULT 0,
      bank_name            TEXT DEFAULT '',
      bank_account_no      TEXT DEFAULT '',
      bank_ifsc            TEXT DEFAULT '',
      bank_branch          TEXT DEFAULT '',
      footer_notes         TEXT DEFAULT 'Thank you for your business!',
      terms_conditions     TEXT DEFAULT '',
      custom_fields        TEXT DEFAULT '[]',
      updated_at           TEXT DEFAULT (datetime('now'))
    );

    -- BUG FIX #7: app_settings table was completely missing — settings route crashed on every call
    CREATE TABLE IF NOT EXISTS app_settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

function seedDefaultData() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0 && !FORCE_SEED) return;

  // System roles
  for (const r of ['Owner', 'Accountant', 'Billing Operator', 'Inventory Manager']) {
    db.prepare(`INSERT OR IGNORE INTO user_roles (name, is_system) VALUES (?, 1)`).run(r);
  }

  // Default admin
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT OR IGNORE INTO users (name, mobile, password, role) VALUES ('Admin', 'admin', ?, 'Owner')`).run(hash);

  // Default branch
  db.prepare(`INSERT OR IGNORE INTO branches (name, store_id, address) VALUES ('Main Branch', 'MAIN-001', 'Main Office')`).run();

  // Default account
  db.prepare(`INSERT OR IGNORE INTO accounts (account_name, account_type, opening_balance, current_balance, is_primary) VALUES ('Cash Account', 'Cash', 0, 0, 1)`).run();

  // Default expense categories
  for (const c of ['Rent', 'Utilities', 'Salary', 'Transport', 'Office Supplies', 'Marketing', 'Maintenance', 'Other']) {
    db.prepare(`INSERT OR IGNORE INTO expense_categories (name) VALUES (?)`).run(c);
  }

  // Default product categories
  for (const c of ['Electronics', 'Furniture', 'Stationery', 'Electrical', 'Services']) {
    db.prepare(`INSERT OR IGNORE INTO categories (name) VALUES (?)`).run(c);
  }

  // Default company profile
  db.prepare(`INSERT OR IGNORE INTO company_profile (id, company_name) VALUES (1, 'My Company')`).run();

  // Default invoice settings
  db.prepare(`INSERT OR IGNORE INTO invoice_settings (id) VALUES (1)`).run();

  // Default app settings
  const insSet = db.prepare(`INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)`);
  insSet.run('currency', 'INR');
  insSet.run('currency_symbol', 'Rs.');
  insSet.run('language', 'en');
  insSet.run('date_format', 'DD/MM/YYYY');
  insSet.run('tax_rate', '0');
  insSet.run('tax_name', 'GST');

  console.log(FORCE_SEED ? 'Default data reseeded (FORCE_SEED=true)' : 'Default data seeded');
}

module.exports = { initDb, getDb, closeDb, getDbPath };

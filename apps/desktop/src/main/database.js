const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'invoicing.db');

let db;

function initialize() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createTables();
  runMigrations();
  seedDefaultData();
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function createTables() {
  db.exec(`
    -- Company Profile
    CREATE TABLE IF NOT EXISTS company_profile (
      id           INTEGER PRIMARY KEY,
      company_name TEXT NOT NULL DEFAULT 'My Company',
      mobile       TEXT,
      email        TEXT,
      address      TEXT,
      logo_path    TEXT
    );

    -- Branches
    CREATE TABLE IF NOT EXISTS branches (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      store_id  TEXT UNIQUE,
      address   TEXT,
      is_active INTEGER DEFAULT 1
    );

    -- Permissions master list
    CREATE TABLE IF NOT EXISTS permissions (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      UNIQUE(module, action)
    );

    -- Role-level default permissions
    CREATE TABLE IF NOT EXISTS role_permissions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      role          TEXT NOT NULL,
      permission_id INTEGER REFERENCES permissions(id),
      granted       INTEGER DEFAULT 1,
      UNIQUE(role, permission_id)
    );

    -- User Roles (system + custom)
    CREATE TABLE IF NOT EXISTS user_roles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      is_system  INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      mobile      TEXT,
      email       TEXT,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'Billing Operator',
      is_active   INTEGER DEFAULT 1,
      avatar_path TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    -- User-level permission overrides
    CREATE TABLE IF NOT EXISTS user_permissions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
      permission_id INTEGER REFERENCES permissions(id),
      granted       INTEGER NOT NULL,
      UNIQUE(user_id, permission_id)
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sku            TEXT UNIQUE,
      name           TEXT NOT NULL,
      category_id    INTEGER REFERENCES categories(id),
      unit           TEXT DEFAULT 'Piece',
      hsn_code       TEXT,
      purchase_price REAL DEFAULT 0,
      selling_price  REAL DEFAULT 0,
      opening_stock  INTEGER DEFAULT 0,
      current_stock  INTEGER DEFAULT 0,
      reorder_level  INTEGER DEFAULT 10,
      barcode        TEXT,
      status         TEXT DEFAULT 'Good',
      is_active      INTEGER DEFAULT 1,
      created_at     TEXT DEFAULT (datetime('now'))
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT,
      email      TEXT,
      address    TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Accounts (Chart of Accounts)
    CREATE TABLE IF NOT EXISTS accounts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name    TEXT NOT NULL,
      account_type    TEXT NOT NULL,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      as_of_date      TEXT,
      is_primary      INTEGER DEFAULT 0,
      is_active       INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    -- Invoices (Sales)
    CREATE TABLE IF NOT EXISTS invoices (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no     TEXT UNIQUE,
      invoice_date   TEXT NOT NULL,
      customer_name  TEXT,
      customer_phone TEXT,
      seller_id      INTEGER REFERENCES users(id),
      branch_id      INTEGER REFERENCES branches(id),
      subtotal       REAL DEFAULT 0,
      tax_amount     REAL DEFAULT 0,
      grand_total    REAL DEFAULT 0,
      payment_mode   TEXT DEFAULT 'Cash',
      cash_amount    REAL DEFAULT 0,
      online_amount  REAL DEFAULT 0,
      internal_notes TEXT,
      status         TEXT DEFAULT 'Draft',
      type           TEXT DEFAULT 'Sale',
      is_credit_sale INTEGER DEFAULT 0,
      paid_amount    REAL DEFAULT 0,
      created_by     INTEGER REFERENCES users(id),
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );

    -- Invoice Items
    CREATE TABLE IF NOT EXISTS invoice_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id   INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
      product_id   INTEGER REFERENCES products(id),
      product_code TEXT,
      product_name TEXT,
      qty          INTEGER NOT NULL,
      rate         REAL NOT NULL,
      amount       REAL NOT NULL
    );

    -- Return & Exchange
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

    -- Return Exchange Items
    CREATE TABLE IF NOT EXISTS return_exchange_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id    INTEGER REFERENCES return_exchange(id) ON DELETE CASCADE,
      product_id   INTEGER REFERENCES products(id),
      product_name TEXT,
      returned_qty INTEGER DEFAULT 0,
      exchange_qty INTEGER DEFAULT 0,
      rate         REAL
    );

    -- Vendors
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

    -- Purchase Invoices
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number         TEXT UNIQUE,
      vendor_id         INTEGER REFERENCES vendors(id),
      vendor_name       TEXT,
      purchase_date     TEXT,
      subtotal          REAL DEFAULT 0,
      grand_total       REAL DEFAULT 0,
      purchase_note     TEXT,
      status            TEXT DEFAULT 'Pending',
      paid_amount       REAL DEFAULT 0,
      pending_amount    REAL DEFAULT 0,
      due_date          TEXT,
      last_payment_date TEXT,
      created_at        TEXT DEFAULT (datetime('now'))
    );

    -- Purchase Invoice Items
    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_invoice_id INTEGER REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      product_id          INTEGER REFERENCES products(id),
      product_name        TEXT,
      product_code        TEXT,
      qty                 INTEGER NOT NULL,
      price               REAL NOT NULL,
      total               REAL NOT NULL
    );

    -- Purchase Returns
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number           TEXT,
      vendor_id           INTEGER REFERENCES vendors(id),
      vendor_name         TEXT,
      original_invoice_id INTEGER REFERENCES purchase_invoices(id),
      purchased_qty       INTEGER,
      return_qty          INTEGER,
      return_total        REAL DEFAULT 0,
      restocking_fee_pct  REAL DEFAULT 0,
      return_reason       TEXT,
      status              TEXT DEFAULT 'Pending',
      order_date          TEXT DEFAULT (datetime('now'))
    );

    -- Purchase Return Items
    CREATE TABLE IF NOT EXISTS purchase_return_items (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_return_id INTEGER REFERENCES purchase_returns(id) ON DELETE CASCADE,
      product_id         INTEGER REFERENCES products(id),
      item_name          TEXT,
      sku                TEXT,
      purchased_qty      INTEGER,
      return_qty         INTEGER DEFAULT 0,
      purchase_price     REAL,
      total              REAL DEFAULT 0
    );

    -- Pay Bills
    CREATE TABLE IF NOT EXISTS pay_bills (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id           INTEGER REFERENCES vendors(id),
      purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
      outstanding_amount  REAL,
      total_payable       REAL,
      last_payment_date   TEXT,
      payment_mode        TEXT,
      due_date            TEXT,
      paying_amount       REAL,
      payment_status      TEXT DEFAULT 'Unpaid',
      created_at          TEXT DEFAULT (datetime('now'))
    );

    -- Banking Transactions
    CREATE TABLE IF NOT EXISTS banking_transactions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      txn_id       TEXT UNIQUE,
      account_id   INTEGER REFERENCES accounts(id),
      account_name TEXT,
      date         TEXT NOT NULL,
      description  TEXT,
      type         TEXT NOT NULL,
      amount       REAL NOT NULL,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_id   TEXT UNIQUE,
      title        TEXT NOT NULL,
      amount       REAL NOT NULL,
      expense_date TEXT NOT NULL,
      category     TEXT,
      account_id   INTEGER REFERENCES accounts(id),
      paid_from    TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    -- Backups log
    CREATE TABLE IF NOT EXISTS backups (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      type      TEXT,
      date_time TEXT,
      size_mb   REAL,
      status    TEXT
    );

    -- Invoice Designer Settings
    CREATE TABLE IF NOT EXISTS invoice_settings (
      id                  INTEGER PRIMARY KEY DEFAULT 1,
      -- Invoice Number
      inv_prefix          TEXT DEFAULT 'INV',
      inv_suffix          TEXT DEFAULT '',
      inv_start_number    INTEGER DEFAULT 1001,
      inv_padding         INTEGER DEFAULT 4,
      -- Seller / Company overrides
      seller_name         TEXT DEFAULT '',
      seller_tagline      TEXT DEFAULT '',
      seller_address      TEXT DEFAULT '',
      seller_phone        TEXT DEFAULT '',
      seller_email        TEXT DEFAULT '',
      seller_website      TEXT DEFAULT '',
      seller_gstin        TEXT DEFAULT '',
      seller_pan          TEXT DEFAULT '',
      seller_logo_path    TEXT DEFAULT '',
      -- Template
      template_color      TEXT DEFAULT '#111111',
      template_style      TEXT DEFAULT 'classic',
      -- Show/Hide Fields
      show_customer_phone INTEGER DEFAULT 1,
      show_customer_email INTEGER DEFAULT 0,
      show_customer_gstin INTEGER DEFAULT 1,
      show_due_date       INTEGER DEFAULT 1,
      show_po_number      INTEGER DEFAULT 1,
      show_hsn            INTEGER DEFAULT 1,
      show_discount       INTEGER DEFAULT 1,
      show_tax_breakdown  INTEGER DEFAULT 1,
      show_bank_details   INTEGER DEFAULT 1,
      -- Bank details on invoice
      bank_name           TEXT DEFAULT '',
      bank_account_no     TEXT DEFAULT '',
      bank_ifsc           TEXT DEFAULT '',
      bank_branch         TEXT DEFAULT '',
      -- Footer
      footer_notes        TEXT DEFAULT 'Thank you for your business!',
      terms_conditions    TEXT DEFAULT 'Payment due within 30 days.',
      -- Custom fields (JSON array of {label, value})
      custom_fields       TEXT DEFAULT '[]'
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      message    TEXT NOT NULL,
      link       TEXT,
      is_read    INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function runMigrations() {
  // Add branch_id to users
  try { db.exec(`ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id)`); } catch(e) {}
  // Add branch_id to products
  try { db.exec(`ALTER TABLE products ADD COLUMN branch_id INTEGER REFERENCES branches(id)`); } catch(e) {}
  // Add branch_id to expenses
  try { db.exec(`ALTER TABLE expenses ADD COLUMN branch_id INTEGER REFERENCES branches(id)`); } catch(e) {}
  // Add branch_id to banking_transactions
  try { db.exec(`ALTER TABLE banking_transactions ADD COLUMN branch_id INTEGER REFERENCES branches(id)`); } catch(e) {}
  // Add branch_id to customers
  try { db.exec(`ALTER TABLE customers ADD COLUMN branch_id INTEGER REFERENCES branches(id)`); } catch(e) {}
  // Add code and contact to branches
  try { db.exec(`ALTER TABLE branches ADD COLUMN code TEXT`); } catch(e) {}
  try { db.exec(`ALTER TABLE branches ADD COLUMN contact TEXT`); } catch(e) {}
  // App settings table
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  )`);
  // Seed default settings
  const insSet = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)');
  insSet.run('currency', 'INR');
  insSet.run('currency_symbol', '₹');
  insSet.run('language', 'en');
  insSet.run('date_format', 'DD/MM/YYYY');
}

function seedDefaultData() {
  const bcrypt = require('bcryptjs');

  // ── Company profile ────────────────────────────────────────────────────────
  const cp = db.prepare('SELECT id FROM company_profile').get();
  if (!cp) {
    db.prepare(`INSERT INTO company_profile (id, company_name, mobile, email, address)
      VALUES (1, 'Acme Electricals', '+91-9876543210', 'info@acme.com', '123 Market Street, Mumbai, India')`).run();
  }

  // ── User Roles ─────────────────────────────────────────────────────────────
  const ur = db.prepare('SELECT id FROM user_roles').get();
  if (!ur) {
    const insertRole = db.prepare(`INSERT INTO user_roles (name, is_system) VALUES (?, 1)`);
    insertRole.run('Owner');
    insertRole.run('Accountant');
    insertRole.run('Billing Operator');
    insertRole.run('Inventory Manager');
  }

  // ── Branches ───────────────────────────────────────────────────────────────
  const br = db.prepare('SELECT id FROM branches').get();
  if (!br) {
    db.prepare(`INSERT INTO branches (name, store_id, address) VALUES ('Main Branch', 'BR-001', 'Mumbai HQ')`).run();
    db.prepare(`INSERT INTO branches (name, store_id, address) VALUES ('Delhi Branch', 'BR-002', 'Delhi Office')`).run();
  }

  // ── Permissions ────────────────────────────────────────────────────────────
  const modules = ['dashboard', 'billing', 'inventory', 'vendors', 'banking', 'expenses', 'reports', 'settings'];
  const actions = ['view', 'create', 'edit', 'delete'];
  const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (module, action) VALUES (?, ?)');
  for (const m of modules) for (const a of actions) insertPerm.run(m, a);

  const roleMatrix = {
    'Owner':             { dashboard: 'vced', billing: 'vced', inventory: 'vced', vendors: 'vced', banking: 'vced', expenses: 'vced', reports: 'vced', settings: 'vced' },
    'Accountant':        { dashboard: 'v---', billing: 'v---', inventory: 'v---', vendors: 'vce-', banking: 'vce-', expenses: 'vced', reports: 'v---', settings: '----' },
    'Billing Operator':  { dashboard: 'v---', billing: 'vce-', inventory: 'v---', vendors: '----', banking: '----', expenses: '----', reports: '----', settings: '----' },
    'Inventory Manager': { dashboard: 'v---', billing: 'v---', inventory: 'vced', vendors: 'v---', banking: '----', expenses: '----', reports: '----', settings: '----' },
  };
  const getPerm = db.prepare('SELECT id FROM permissions WHERE module = ? AND action = ?');
  const insertRP = db.prepare('INSERT OR IGNORE INTO role_permissions (role, permission_id, granted) VALUES (?, ?, ?)');
  for (const [role, mods] of Object.entries(roleMatrix)) {
    for (const [mod, flags] of Object.entries(mods)) {
      flags.split('').forEach((f, i) => {
        const perm = getPerm.get(mod, actions[i]);
        if (perm) insertRP.run(role, perm.id, f !== '-' ? 1 : 0);
      });
    }
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  const user = db.prepare('SELECT id FROM users').get();
  if (!user) {
    const hash  = bcrypt.hashSync('admin123', 10);
    const hash2 = bcrypt.hashSync('accountant123', 10);
    const hash3 = bcrypt.hashSync('billing123', 10);
    const hash4 = bcrypt.hashSync('inventory123', 10);
    const insU  = db.prepare(`INSERT INTO users (name, mobile, email, password, role, is_active) VALUES (?,?,?,?,?,1)`);
    insU.run('admin', '9876543210', 'admin@acme.com',  hash,  'Owner');
    insU.run('priya', '9876543211', 'priya@acme.com',  hash2, 'Accountant');
    insU.run('raj',   '9876543212', 'raj@acme.com',    hash3, 'Billing Operator');
    insU.run('meena', '9876543213', 'meena@acme.com',  hash4, 'Inventory Manager');
  }

  // ── Accounts ───────────────────────────────────────────────────────────────
  const acct = db.prepare('SELECT id FROM accounts').get();
  if (!acct) {
    const accts = [
      ['Cash Account',        'Cash',     45000,    1],
      ['HDFC Bank - Current', 'Bank',     820000,   1],
      ['ICICI Bank - Savings','Bank',     150000,   0],
      ['Owner Capital',       'Capital',  1000000,  0],
      ['Sales Account',       'Sales',    0,        0],
      ['Purchase Account',    'Purchase', 0,        0],
      ['Expense Account',     'Expense',  15400,    0],
    ];
    const ins = db.prepare(`INSERT INTO accounts (account_name, account_type, opening_balance, current_balance, is_primary) VALUES (?,?,?,?,?)`);
    accts.forEach(([n, t, b, p]) => ins.run(n, t, b, b, p));
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  const cat = db.prepare('SELECT id FROM categories').get();
  if (!cat) {
    const cats = ['LED & Lighting','Switches & Sockets','Wiring & Cables','Fans & Appliances','Solar Products','Tools & Safety','MCB & Distribution','Batteries','CCTV & Security','Inverters'];
    const ins = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
    cats.forEach(c => ins.run(c));
  }

  // ── Customers ──────────────────────────────────────────────────────────────
  const cust = db.prepare('SELECT id FROM customers').get();
  if (!cust) {
    const custData = [
      ['Sharma Electricals','9876501001','sharma@email.com','12 MG Road, Mumbai'],
      ['Harshit Pandey','9876501002','harshit@email.com','34 Lajpat Nagar, Delhi'],
      ['Delhi Traders','9876501003','delhi@email.com','56 Connaught Place, Delhi'],
      ['Raj Electronics','9876501004','raj@email.com','78 Bandra West, Mumbai'],
      ['Sunita Supplies','9876501005','sunita@email.com','90 Linking Road, Mumbai'],
      ['Mahesh Hardware','9876501006','mahesh@email.com','11 Saket, Delhi'],
      ['Patel Stores','9876501007','patel@email.com','22 Andheri East, Mumbai'],
      ['Kumar Enterprises','9876501008','kumar@email.com','33 Vasant Kunj, Delhi'],
      ['Singh Trading','9876501009','singh@email.com','44 Powai, Mumbai'],
      ['Gupta Electronics','9876501010','gupta@email.com','55 Rohini, Delhi'],
      ['Verma & Sons','9876501011','verma@email.com','66 Kandivali, Mumbai'],
      ['Joshi Mart','9876501012','joshi@email.com','77 Dwarka, Delhi'],
      ['Agarwal Imports','9876501013','agarwal@email.com','88 Borivali, Mumbai'],
      ['Bright Lights Co.','9876501014','bright@email.com','99 Rajouri Garden, Delhi'],
      ['Power House Ltd','9876501015','power@email.com','100 Malad, Mumbai'],
      ['Tech Vision','9876501016','tech@email.com','101 Pitampura, Delhi'],
      ['Global Supplies','9876501017','global@email.com','102 Goregaon, Mumbai'],
      ['National Grid','9876501018','ngrid@email.com','103 Janakpuri, Delhi'],
      ['MTN South Africa','9876501019','mtn@email.com','104 Vile Parle, Mumbai'],
      ['Sahel Trading','9876501020','sahel@email.com','105 Karol Bagh, Delhi'],
    ];
    const ins = db.prepare(`INSERT OR IGNORE INTO customers (name, phone, email, address) VALUES (?,?,?,?)`);
    custData.forEach(c => ins.run(...c));
  }

  // ── Vendors ────────────────────────────────────────────────────────────────
  const vend = db.prepare('SELECT id FROM vendors').get();
  if (!vend) {
    const vendData = [
      ['Harshit Pandey','Harshit01Imports','harshit@mail.com','555-533-6515','New York','NY','10001','HDFC-001','ACC-1001',0],
      ['Industrial Solutions Ltd','IndSol','contact@indsol.com','555-400-1234','Chicago','IL','60601','ICICI-002','ACC-1002',15000],
      ['Global Supplies Ltd','GlobalSup','info@globalsup.com','555-300-9876','Los Angeles','CA','90001','SBI-003','ACC-1003',8500],
      ['Sahel Trading','SahelTrade','trade@sahel.com','555-200-5555','Houston','TX','77001','AXIS-004','ACC-1004',0],
      ['Electro Wholesale','ElectroWS','sales@electrows.com','555-100-7777','Phoenix','AZ','85001','BOB-005','ACC-1005',22000],
    ];
    const ins = db.prepare(`INSERT OR IGNORE INTO vendors (vendor_name,company_name,email,phone,city,province_state,postal_code,account_name,account_number,outstanding_balance) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    vendData.forEach(v => ins.run(...v));
  }

  // ── Products ───────────────────────────────────────────────────────────────
  const prod = db.prepare('SELECT id FROM products').get();
  if (!prod) {
    const catMap = {};
    db.prepare(`SELECT id, name FROM categories`).all().forEach(c => { catMap[c.name] = c.id; });
    const productData = [
      ['LED Bulb 9W','LED & Lighting','Piece','85395000',120,140,450,10,'8539500001'],
      ['LED Bulb 15W','LED & Lighting','Piece','85395000',150,180,300,15,'8539500002'],
      ['LED Strip Light 5M','LED & Lighting','Roll','85395001',400,550,80,5,'8539500103'],
      ['LED Downlight 12W','LED & Lighting','Piece','94051090',280,400,80,10,'9405109001'],
      ['LED Street Light 50W','LED & Lighting','Piece','94051090',2200,3200,15,3,'9405109002'],
      ['9W Light Bulb','LED & Lighting','Piece','85395000',110,300,103,10,'8539500010'],
      ['MCB 32A Single Pole','MCB & Distribution','Piece','85362090',200,280,150,20,'8536209001'],
      ['MCB 63A Double Pole','MCB & Distribution','Piece','85362090',450,600,75,10,'8536209002'],
      ['Distribution Box 4-Way','MCB & Distribution','Piece','85362090',800,1100,40,5,'8536209003'],
      ['Modular Switch 6A','Switches & Sockets','Piece','85364900',45,65,500,50,'8536490001'],
      ['Modular Socket 16A','Switches & Sockets','Piece','85364900',60,90,400,40,'8536490002'],
      ['2-Pin Plug Top','Switches & Sockets','Piece','85364900',25,40,600,50,'8536490003'],
      ['3-Pin Plug Top','Switches & Sockets','Piece','85364900',35,55,550,50,'8536490004'],
      ['1.5mm PVC Wire 90M','Wiring & Cables','Roll','85444200',1200,1600,60,5,'8544420001'],
      ['2.5mm PVC Wire 90M','Wiring & Cables','Roll','85444200',1800,2400,40,5,'8544420002'],
      ['4mm XLPE Cable 100M','Wiring & Cables','Roll','85444200',4500,6000,20,3,'8544420003'],
      ['PVC Conduit 25mm 3M','Wiring & Cables','Piece','39172900',80,120,200,20,'3917290001'],
      ['Junction Box 4x4','Wiring & Cables','Piece','85389090',60,95,250,25,'8538909001'],
      ['Ceiling Fan 48"','Fans & Appliances','Piece','84145100',1800,2500,30,5,'8414510001'],
      ['Exhaust Fan 12"','Fans & Appliances','Piece','84145100',900,1300,25,5,'8414510002'],
      ['Solar Panel 100W','Solar Products','Piece','85414020',4500,6500,15,3,'8541402001'],
      ['Solar Panel 250W','Solar Products','Piece','85414020',9000,13000,10,2,'8541402002'],
      ['Solar Charge Controller 20A','Solar Products','Piece','85044090',1200,1800,20,5,'8504409001'],
      ['Multimeter Digital','Tools & Safety','Piece','90303300',800,1200,35,5,'9030330001'],
      ['Wire Stripper','Tools & Safety','Piece','82032000',200,350,80,10,'8203200001'],
      ['Safety Gloves (Large)','Tools & Safety','Pair','39262090',150,250,100,20,'3926209001'],
      ['Safety Goggles Anti-Fog','Tools & Safety','Piece','90049000',125,200,50,10,'9004900001'],
      ['Wireless Mouse','Tools & Safety','Piece','84716060',250,575,40,5,'8471606001'],
      ['Industrial Drill Bit 12mm','Tools & Safety','Piece','82079019',450,700,25,5,'8207901901'],
      ['12V 100Ah Battery','Batteries','Piece','85072000',8000,11000,12,3,'8507200001'],
      ['12V 200Ah Battery','Batteries','Piece','85072000',14000,19000,8,2,'8507200002'],
      ['CCTV Camera 2MP','CCTV & Security','Piece','85258090',1500,2200,20,5,'8525809001'],
      ['DVR 4-Channel','CCTV & Security','Piece','85219090',2800,4000,10,3,'8521909001'],
      ['500VA Inverter','Inverters','Piece','85044090',3500,5000,15,3,'8504409002'],
      ['1KVA Inverter','Inverters','Piece','85044090',6000,8500,10,2,'8504409003'],
    ];
    const ins = db.prepare(`INSERT OR IGNORE INTO products (sku,name,category_id,unit,hsn_code,purchase_price,selling_price,opening_stock,current_stock,reorder_level,barcode) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    productData.forEach(([name, catName, unit, hsn, pp, sp, stock, reorder, barcode], idx) => {
      const sku = `ITM-${String(idx + 1).padStart(3, '0')}`;
      ins.run(sku, name, catMap[catName] || 1, unit, hsn, pp, sp, stock, stock, reorder, barcode);
    });
    db.prepare(`UPDATE products SET status = CASE WHEN current_stock <= 5 THEN 'Critical' WHEN current_stock <= reorder_level THEN 'Low' ELSE 'Good' END`).run();
  }

  // ── Invoices ───────────────────────────────────────────────────────────────
  const inv = db.prepare('SELECT id FROM invoices').get();
  if (!inv) {
    const productRows  = db.prepare(`SELECT id, sku, name, selling_price FROM products`).all();
    const customerRows = db.prepare(`SELECT id, name, phone FROM customers`).all();
    const userRows     = db.prepare(`SELECT id FROM users WHERE role IN ('Billing Operator','Owner') LIMIT 2`).all();
    const branchRows   = db.prepare(`SELECT id FROM branches`).all();
    const statuses  = ['Paid','Paid','Paid','Draft','Credit'];
    const payModes  = ['Cash','Card','UPI','EFT','Cash'];
    const insInv     = db.prepare(`INSERT OR IGNORE INTO invoices (invoice_no,invoice_date,customer_name,customer_phone,seller_id,branch_id,subtotal,tax_amount,grand_total,payment_mode,cash_amount,status,is_credit_sale,paid_amount,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insInvItem = db.prepare(`INSERT INTO invoice_items (invoice_id,product_id,product_code,product_name,qty,rate,amount) VALUES (?,?,?,?,?,?,?)`);
    for (let i = 0; i < 30; i++) {
      const invNo    = `ETS-26${String(i + 1).padStart(3, '0')}`;
      const cust2    = customerRows[i % customerRows.length];
      const seller   = userRows[i % userRows.length];
      const branch   = branchRows[i % branchRows.length];
      const status   = statuses[i % statuses.length];
      const payMode  = payModes[i % payModes.length];
      const isCredit = status === 'Credit' ? 1 : 0;
      const date     = new Date(2026, 0, 1 + i * 3).toISOString().split('T')[0];
      const itemCount = 2 + (i % 3);
      let subtotal = 0;
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const p   = productRows[(i * 3 + j) % productRows.length];
        const qty = 2 + j;
        const amt = qty * p.selling_price;
        subtotal += amt;
        items.push([p.id, p.sku, p.name, qty, p.selling_price, amt]);
      }
      const tax   = Math.round(subtotal * 0.18);
      const grand = subtotal + tax;
      const paid  = isCredit ? Math.round(grand * 0.3) : grand;
      const r = insInv.run(invNo, date, cust2.name, cust2.phone, seller.id, branch.id, subtotal, tax, grand, payMode, grand, status, isCredit, paid, seller.id);
      if (r.lastInsertRowid) items.forEach(item => insInvItem.run(r.lastInsertRowid, ...item));
    }
  }

  // ── Purchase Invoices ──────────────────────────────────────────────────────
  const po = db.prepare('SELECT id FROM purchase_invoices').get();
  if (!po) {
    const productRows = db.prepare(`SELECT id, sku, name, purchase_price FROM products`).all();
    const vendorRows  = db.prepare(`SELECT id, vendor_name FROM vendors`).all();
    const insPO     = db.prepare(`INSERT OR IGNORE INTO purchase_invoices (po_number,vendor_id,vendor_name,purchase_date,subtotal,grand_total,status,paid_amount,pending_amount) VALUES (?,?,?,?,?,?,?,?,?)`);
    const insPOItem = db.prepare(`INSERT INTO purchase_invoice_items (purchase_invoice_id,product_id,product_name,product_code,qty,price,total) VALUES (?,?,?,?,?,?,?)`);
    for (let i = 0; i < 10; i++) {
      const poNo   = `PO-2025-${String(i + 1).padStart(6, '0')}`;
      const vendor = vendorRows[i % vendorRows.length];
      const date   = new Date(2025, i % 12, 5).toISOString().split('T')[0];
      const p      = productRows[i % productRows.length];
      const qty    = 50 + i * 10;
      const total  = qty * p.purchase_price;
      const status = i % 3 === 0 ? 'Received' : 'Pending';
      const paid   = status === 'Received' ? total : Math.round(total * 0.3);
      const r = insPO.run(poNo, vendor.id, vendor.vendor_name, date, total, total, status, paid, total - paid);
      if (r.lastInsertRowid) insPOItem.run(r.lastInsertRowid, p.id, p.name, p.sku, qty, p.purchase_price, total);
    }
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  const exp = db.prepare('SELECT id FROM expenses').get();
  if (!exp) {
    const cashId = db.prepare(`SELECT id FROM accounts WHERE account_type='Cash' LIMIT 1`).get()?.id || 1;
    const expData = [
      ['Office Rent',         25000, '2026-01-01', 'Rent & Office'],
      ['Electricity Bill',     4500, '2026-01-05', 'Utilities'],
      ['Staff Salary - Jan',  45000, '2026-01-31', 'Payroll & Salary'],
      ['Internet Bill',        2000, '2026-01-10', 'Utilities'],
      ['Facebook Ads',         8000, '2026-01-15', 'Marketing & Sales'],
      ['Office Rent - Feb',   25000, '2026-02-01', 'Rent & Office'],
      ['Electricity Bill Feb', 4200, '2026-02-05', 'Utilities'],
      ['Staff Salary - Feb',  45000, '2026-02-28', 'Payroll & Salary'],
      ['Stationery & Supplies',1500, '2026-02-12', 'Rent & Office'],
      ['Google Ads',           6000, '2026-02-20', 'Marketing & Sales'],
      ['Water Bill',           1200, '2026-03-05', 'Utilities'],
      ['Office Maintenance',   3500, '2026-03-10', 'Rent & Office'],
    ];
    const ins = db.prepare(`INSERT OR IGNORE INTO expenses (expense_id,title,amount,expense_date,category,account_id,paid_from) VALUES (?,?,?,?,?,?,?)`);
    expData.forEach(([title, amount, date, category], idx) => {
      ins.run(`EXP-26${String(idx + 1).padStart(3, '0')}`, title, amount, date, category, cashId, 'Cash Account');
    });
  }

  // ── Banking Transactions ───────────────────────────────────────────────────
  const txn = db.prepare('SELECT id FROM banking_transactions').get();
  if (!txn) {
    const hdfc = db.prepare(`SELECT id FROM accounts WHERE account_name LIKE 'HDFC%' LIMIT 1`).get();
    if (hdfc) {
      const txns = [
        ['Payment from Sharma Electricals', 'Credit', 12450, '2026-01-15'],
        ['Payment from Raj Electronics',    'Credit',  8000, '2026-01-20'],
        ['Vendor Payment - Harshit Pandey', 'Debit',  15000, '2026-01-22'],
        ['Payment from Delhi Traders',      'Credit', 22000, '2026-02-01'],
        ['Staff Salary Transfer',           'Debit',  45000, '2026-02-05'],
        ['Payment from Gupta Electronics',  'Credit',  5500, '2026-02-10'],
        ['Vendor Payment - Electro WS',     'Debit',  30000, '2026-02-15'],
        ['Payment from Power House Ltd',    'Credit', 18000, '2026-02-20'],
        ['Office Rent Payment',             'Debit',  25000, '2026-03-01'],
        ['Payment from Tech Vision',        'Credit',  9800, '2026-03-05'],
      ];
      const ins = db.prepare(`INSERT OR IGNORE INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`);
      txns.forEach(([desc, type, amount, date], idx) => {
        ins.run(`TXN-26${String(idx + 1).padStart(3, '0')}`, hdfc.id, 'HDFC Bank - Current', date, desc, type, amount);
        const delta = type === 'Credit' ? amount : -amount;
        db.prepare(`UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`).run(delta, hdfc.id);
      });
    }
  }
}

module.exports = { initialize, getDb, runMigrations };

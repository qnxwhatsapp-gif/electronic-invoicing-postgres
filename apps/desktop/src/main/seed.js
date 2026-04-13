/**
 * Seed script — run with: node src/main/seed.js
 * Inserts 50 products, 20 customers, 5 vendors, 30 invoices, 10 purchase invoices, expenses
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(os.homedir(), 'AppData', 'Roaming', 'electronic-invoicing-app', 'invoicing.db');
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

console.log('🌱 Seeding database...');

// ─── CUSTOMERS ────────────────────────────────────────────────────────────
const customers = [
  ['Sharma Electricals', '9876501001', 'sharma@email.com'],
  ['Harshit Pandey', '9876501002', 'harshit@email.com'],
  ['Delhi Traders', '9876501003', 'delhi@email.com'],
  ['Raj Electronics', '9876501004', 'raj@email.com'],
  ['Sunita Supplies', '9876501005', 'sunita@email.com'],
  ['Mahesh Hardware', '9876501006', 'mahesh@email.com'],
  ['Patel Stores', '9876501007', 'patel@email.com'],
  ['Kumar Enterprises', '9876501008', 'kumar@email.com'],
  ['Singh Trading', '9876501009', 'singh@email.com'],
  ['Gupta Electronics', '9876501010', 'gupta@email.com'],
  ['Verma & Sons', '9876501011', 'verma@email.com'],
  ['Joshi Mart', '9876501012', 'joshi@email.com'],
  ['Agarwal Imports', '9876501013', 'agarwal@email.com'],
  ['MTN South Africa', '9876501014', 'mtn@email.com'],
  ['Global Supplies', '9876501015', 'global@email.com'],
  ['Sahel Trading', '9876501016', 'sahel@email.com'],
  ['Bright Lights Co.', '9876501017', 'bright@email.com'],
  ['National Grid', '9876501018', 'ngrid@email.com'],
  ['Power House Ltd', '9876501019', 'power@email.com'],
  ['Tech Vision', '9876501020', 'tech@email.com'],
];
const insCust = db.prepare(`INSERT OR IGNORE INTO customers (name,phone,email) VALUES (?,?,?)`);
customers.forEach(c => insCust.run(...c));
console.log('✅ Customers seeded');

// ─── VENDORS ──────────────────────────────────────────────────────────────
const vendors = [
  ['Harshit Pandey', 'Harshit01Imports', 'harshit@mail.com', '555-533-6515', 'New York', 'NY'],
  ['Industrial Solutions Ltd', 'IndSol', 'contact@indsol.com', '555-400-1234', 'Chicago', 'IL'],
  ['Global Supplies Ltd', 'GlobalSup', 'info@globalsup.com', '555-300-9876', 'Los Angeles', 'CA'],
  ['Sahel Trading', 'SahelTrade', 'trade@sahel.com', '555-200-5555', 'Houston', 'TX'],
  ['Electro Wholesale', 'ElectroWS', 'sales@electrows.com', '555-100-7777', 'Phoenix', 'AZ'],
];
const insVend = db.prepare(`INSERT OR IGNORE INTO vendors (vendor_name,company_name,email,phone,city,province_state) VALUES (?,?,?,?,?,?)`);
vendors.forEach(v => insVend.run(...v));
console.log('✅ Vendors seeded');

// ─── PRODUCTS ─────────────────────────────────────────────────────────────
const catMap = {};
db.prepare(`SELECT id,name FROM categories`).all().forEach(c => { catMap[c.name] = c.id; });

const products = [
  ['LED Bulb 9W', 'LED & Lighting', 'Piece', '85395000', 120, 140, 450, 10, '8539500001'],
  ['LED Bulb 15W', 'LED & Lighting', 'Piece', '85395000', 150, 180, 300, 15, '8539500002'],
  ['LED Strip Light 5M', 'LED & Lighting', 'Roll', '85395001', 400, 550, 80, 5, '8539500103'],
  ['MCB 32A Single Pole', 'MCB & Distribution', 'Piece', '85362090', 200, 280, 150, 20, '8536209001'],
  ['MCB 63A Double Pole', 'MCB & Distribution', 'Piece', '85362090', 450, 600, 75, 10, '8536209002'],
  ['Distribution Box 4-Way', 'MCB & Distribution', 'Piece', '85362090', 800, 1100, 40, 5, '8536209003'],
  ['Modular Switch 6A', 'Switches & Sockets', 'Piece', '85364900', 45, 65, 500, 50, '8536490001'],
  ['Modular Socket 16A', 'Switches & Sockets', 'Piece', '85364900', 60, 90, 400, 40, '8536490002'],
  ['2-Pin Plug Top', 'Switches & Sockets', 'Piece', '85364900', 25, 40, 600, 50, '8536490003'],
  ['3-Pin Plug Top', 'Switches & Sockets', 'Piece', '85364900', 35, 55, 550, 50, '8536490004'],
  ['1.5mm PVC Wire 90M', 'Wiring & Cables', 'Roll', '85444200', 1200, 1600, 60, 5, '8544420001'],
  ['2.5mm PVC Wire 90M', 'Wiring & Cables', 'Roll', '85444200', 1800, 2400, 40, 5, '8544420002'],
  ['4mm XLPE Cable 100M', 'Wiring & Cables', 'Roll', '85444200', 4500, 6000, 20, 3, '8544420003'],
  ['Ceiling Fan 48"', 'Fans & Appliances', 'Piece', '84145100', 1800, 2500, 30, 5, '8414510001'],
  ['Exhaust Fan 12"', 'Fans & Appliances', 'Piece', '84145100', 900, 1300, 25, 5, '8414510002'],
  ['Solar Panel 100W', 'Solar Products', 'Piece', '85414020', 4500, 6500, 15, 3, '8541402001'],
  ['Solar Panel 250W', 'Solar Products', 'Piece', '85414020', 9000, 13000, 10, 2, '8541402002'],
  ['Solar Charge Controller 20A', 'Solar Products', 'Piece', '85044090', 1200, 1800, 20, 5, '8504409001'],
  ['Multimeter Digital', 'Tools & Safety', 'Piece', '90303300', 800, 1200, 35, 5, '9030330001'],
  ['Wire Stripper', 'Tools & Safety', 'Piece', '82032000', 200, 350, 80, 10, '8203200001'],
  ['Safety Gloves (Large)', 'Tools & Safety', 'Pair', '39262090', 150, 250, 100, 20, '3926209001'],
  ['Safety Goggles Anti-Fog', 'Tools & Safety', 'Piece', '90049000', 125, 200, 50, 10, '9004900001'],
  ['12V 100Ah Battery', 'Batteries', 'Piece', '85072000', 8000, 11000, 12, 3, '8507200001'],
  ['12V 200Ah Battery', 'Batteries', 'Piece', '85072000', 14000, 19000, 8, 2, '8507200002'],
  ['CCTV Camera 2MP', 'CCTV & Security', 'Piece', '85258090', 1500, 2200, 20, 5, '8525809001'],
  ['DVR 4-Channel', 'CCTV & Security', 'Piece', '85219090', 2800, 4000, 10, 3, '8521909001'],
  ['500VA Inverter', 'Inverters', 'Piece', '85044090', 3500, 5000, 15, 3, '8504409002'],
  ['1KVA Inverter', 'Inverters', 'Piece', '85044090', 6000, 8500, 10, 2, '8504409003'],
  ['PVC Conduit 25mm 3M', 'Wiring & Cables', 'Piece', '39172900', 80, 120, 200, 20, '3917290001'],
  ['Junction Box 4"x4"', 'Wiring & Cables', 'Piece', '85389090', 60, 95, 250, 25, '8538909001'],
  ['LED Downlight 12W', 'LED & Lighting', 'Piece', '94051090', 280, 400, 80, 10, '9405109001'],
  ['LED Street Light 50W', 'LED & Lighting', 'Piece', '94051090', 2200, 3200, 15, 3, '9405109002'],
  ['Wireless Logitech Mouse', 'Tools & Safety', 'Piece', '84716060', 250, 575, 40, 5, '8471606001'],
  ['9W Light Bulb', 'LED & Lighting', 'Piece', '85395000', 110, 300, 103, 10, '8539500010'],
  ['Industrial Drill Bit 12mm', 'Tools & Safety', 'Piece', '82079019', 450, 700, 25, 5, '8207901901'],
];

let skuSeq = 1;
const insProd = db.prepare(`INSERT OR IGNORE INTO products (sku,name,category_id,unit,hsn_code,purchase_price,selling_price,opening_stock,current_stock,reorder_level,barcode) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
products.forEach(([name, cat, unit, hsn, pp, sp, stock, reorder, barcode]) => {
  const sku = `ITM-${String(skuSeq++).padStart(3, '0')}`;
  const catId = catMap[cat] || 1;
  insProd.run(sku, name, catId, unit, hsn, pp, sp, stock, stock, reorder, barcode);
});
console.log('✅ Products seeded');

// Update stock status
db.prepare(`UPDATE products SET status = CASE WHEN current_stock <= 5 THEN 'Critical' WHEN current_stock <= reorder_level THEN 'Low' ELSE 'Good' END`).run();

// ─── INVOICES ─────────────────────────────────────────────────────────────
const existingInvoices = db.prepare(`SELECT COUNT(*) as c FROM invoices`).get().c;
if (existingInvoices === 0) {
  const productRows = db.prepare(`SELECT id, sku, name, selling_price, purchase_price FROM products`).all();
  const customerRows = db.prepare(`SELECT id, name, phone FROM customers`).all();
  const userRows = db.prepare(`SELECT id FROM users WHERE role = 'Billing Operator' OR role = 'Owner' LIMIT 2`).all();
  const branchRows = db.prepare(`SELECT id FROM branches`).all();

  const statuses = ['Paid', 'Paid', 'Paid', 'Draft', 'Credit'];
  const payModes = ['Cash', 'Card', 'UPI', 'EFT', 'Cash'];

  let invSeq = 1;
  const insInv = db.prepare(`INSERT OR IGNORE INTO invoices (invoice_no,invoice_date,customer_name,customer_phone,seller_id,branch_id,subtotal,tax_amount,grand_total,payment_mode,cash_amount,status,is_credit_sale,paid_amount,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insInvItem = db.prepare(`INSERT INTO invoice_items (invoice_id,product_id,product_code,product_name,qty,rate,amount) VALUES (?,?,?,?,?,?,?)`);

  for (let i = 0; i < 30; i++) {
    const year = '26';
    const invNo = `ETS-${year}${String(invSeq++).padStart(3, '0')}`;
    const cust = customerRows[i % customerRows.length];
    const seller = userRows[i % userRows.length];
    const branch = branchRows[i % branchRows.length];
    const status = statuses[i % statuses.length];
    const payMode = payModes[i % payModes.length];
    const isCredit = status === 'Credit' ? 1 : 0;
    const dateOffset = i * 3;
    const date = new Date(2026, 0, 1 + dateOffset).toISOString().split('T')[0];

    // Pick 2-4 random products
    const itemCount = 2 + (i % 3);
    let subtotal = 0;
    const items = [];
    for (let j = 0; j < itemCount; j++) {
      const prod = productRows[(i * 3 + j) % productRows.length];
      const qty = 2 + j;
      const rate = prod.selling_price;
      const amount = qty * rate;
      subtotal += amount;
      items.push({ product_id: prod.id, sku: prod.sku, name: prod.name, qty, rate, amount });
    }
    const tax = Math.round(subtotal * 0.18);
    const grand = subtotal + tax;
    const paidAmt = isCredit ? Math.round(grand * 0.3) : grand;

    const r = insInv.run(invNo, date, cust.name, cust.phone, seller.id, branch.id, subtotal, tax, grand, payMode, grand, status, isCredit, paidAmt, seller.id);
    if (r.changes === 1 && r.lastInsertRowid) {
      items.forEach(item => insInvItem.run(r.lastInsertRowid, item.product_id, item.sku, item.name, item.qty, item.rate, item.amount));
    }
  }
  console.log('✅ Invoices seeded');
} else {
  console.log('ℹ️ Invoices already exist, skipping invoice seed');
}

// ─── PURCHASE INVOICES ────────────────────────────────────────────────────
const existingPurchases = db.prepare(`SELECT COUNT(*) as c FROM purchase_invoices`).get().c;
if (existingPurchases === 0) {
  const vendorRows = db.prepare(`SELECT id, vendor_name FROM vendors`).all();
  const productRows = db.prepare(`SELECT id, sku, name, purchase_price FROM products`).all();
  let poSeq = 1;
  const insPO = db.prepare(`INSERT OR IGNORE INTO purchase_invoices (po_number,vendor_id,vendor_name,purchase_date,subtotal,grand_total,status,paid_amount,pending_amount) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insPOItem = db.prepare(`INSERT INTO purchase_invoice_items (purchase_invoice_id,product_id,product_name,product_code,qty,price,total) VALUES (?,?,?,?,?,?,?)`);

  for (let i = 0; i < 10; i++) {
    const poNo = `PO-2025-${String(poSeq++).padStart(6, '0')}`;
    const vendor = vendorRows[i % vendorRows.length];
    const date = new Date(2025, i % 12, 5).toISOString().split('T')[0];
    const prod = productRows[i % productRows.length];
    const qty = 50 + i * 10;
    const price = prod.purchase_price;
    const total = qty * price;
    const status = i % 3 === 0 ? 'Received' : 'Pending';
    const paid = status === 'Received' ? total : Math.round(total * 0.3);

    const r = insPO.run(poNo, vendor.id, vendor.vendor_name, date, total, total, status, paid, total - paid);
    if (r.changes === 1 && r.lastInsertRowid) insPOItem.run(r.lastInsertRowid, prod.id, prod.name, prod.sku, qty, price, total);
  }
  console.log('✅ Purchase invoices seeded');
} else {
  console.log('ℹ️ Purchase invoices already exist, skipping purchase seed');
}

// ─── EXPENSES ─────────────────────────────────────────────────────────────
const cashAccountId = db.prepare(`SELECT id FROM accounts WHERE account_type='Cash' LIMIT 1`).get()?.id || 1;
const expenseData = [
  ['Office Rent', 25000, '2026-01-01', 'Rent & Office'],
  ['Electricity Bill', 4500, '2026-01-05', 'Utilities'],
  ['Staff Salary - Jan', 45000, '2026-01-31', 'Payroll & Salary'],
  ['Internet Bill', 2000, '2026-01-10', 'Utilities'],
  ['Facebook Ads', 8000, '2026-01-15', 'Marketing & Sales'],
  ['Office Rent - Feb', 25000, '2026-02-01', 'Rent & Office'],
  ['Electricity Bill - Feb', 4200, '2026-02-05', 'Utilities'],
  ['Staff Salary - Feb', 45000, '2026-02-28', 'Payroll & Salary'],
  ['Stationery & Supplies', 1500, '2026-02-12', 'Rent & Office'],
  ['Google Ads', 6000, '2026-02-20', 'Marketing & Sales'],
];
const insExp = db.prepare(`INSERT OR IGNORE INTO expenses (expense_id,title,amount,expense_date,category,account_id,paid_from) VALUES (?,?,?,?,?,?,?)`);
expenseData.forEach(([title, amount, date, category], idx) => {
  insExp.run(`EXP-26${String(idx + 1).padStart(3, '0')}`, title, amount, date, category, cashAccountId, 'Cash Account');
});
console.log('✅ Expenses seeded');

// ─── BANKING TRANSACTIONS ─────────────────────────────────────────────────
const hdfc = db.prepare(`SELECT id FROM accounts WHERE account_name LIKE 'HDFC%' LIMIT 1`).get();
const txns = [
  ['Payment from Sharma Electricals', 'Credit', 12450, '2026-01-15'],
  ['Payment from Raj Electronics', 'Credit', 8000, '2026-01-20'],
  ['Vendor Payment - Harshit Pandey', 'Debit', 15000, '2026-01-22'],
  ['Payment from Delhi Traders', 'Credit', 22000, '2026-02-01'],
  ['Staff Salary Transfer', 'Debit', 45000, '2026-02-05'],
  ['Payment from Gupta Electronics', 'Credit', 5500, '2026-02-10'],
];
if (hdfc) {
  const insTxn = db.prepare(`INSERT OR IGNORE INTO banking_transactions (txn_id,account_id,account_name,date,description,type,amount) VALUES (?,?,?,?,?,?,?)`);
  txns.forEach(([desc, type, amount, date], idx) => {
    insTxn.run(`TXN-26${String(idx + 1).padStart(3, '0')}`, hdfc.id, 'HDFC Bank - Current', date, desc, type, amount);
    const delta = type === 'Credit' ? amount : -amount;
    db.prepare(`UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?`).run(delta, hdfc.id);
  });
}
console.log('✅ Banking transactions seeded');

console.log('\n🎉 Database seeded successfully!');
console.log('\nDefault login credentials:');
console.log('  Owner:             admin / admin123');
console.log('  Accountant:        priya / accountant123');
console.log('  Billing Operator:  raj / billing123');
console.log('  Inventory Manager: meena / inventory123');

db.close();

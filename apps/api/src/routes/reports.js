const router = require('express').Router();
const { getDb } = require('../db/database');

// Sales report
router.get('/sales', (req, res) => {
  try {
    const { from, to, branch_id } = req.query;
    const db = getDb();
    let q = `SELECT * FROM invoices WHERE status NOT IN ('Draft','Deleted')`;
    const params = [];
    if (from) { q += ` AND invoice_date >= ?`; params.push(from); }
    if (to) { q += ` AND invoice_date <= ?`; params.push(to); }
    if (branch_id) { q += ` AND branch_id=?`; params.push(branch_id); }
    q += ` ORDER BY invoice_date DESC`;
    const invoices = db.prepare(q).all(...params);
    const totalSales = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
    const totalPending = invoices.reduce((s, i) => s + ((i.grand_total || 0) - (i.paid_amount || 0)), 0);
    res.json({ invoices, totalSales, totalPaid, totalPending });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Purchase report
router.get('/purchases', (req, res) => {
  try {
    const { from, to, vendor_id } = req.query;
    const db = getDb();
    let q = `SELECT pi.*, v.vendor_name FROM purchase_invoices pi LEFT JOIN vendors v ON v.id=pi.vendor_id WHERE 1=1`;
    const params = [];
    if (from) { q += ` AND pi.purchase_date >= ?`; params.push(from); }
    if (to) { q += ` AND pi.purchase_date <= ?`; params.push(to); }
    if (vendor_id) { q += ` AND pi.vendor_id=?`; params.push(vendor_id); }
    q += ` ORDER BY pi.purchase_date DESC`;
    const purchases = db.prepare(q).all(...params);
    const totalPurchases = purchases.reduce((s, p) => s + (p.grand_total || 0), 0);
    res.json({ purchases, totalPurchases });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Expense report
router.get('/expenses', (req, res) => {
  try {
    const { from, to, category } = req.query;
    const db = getDb();
    let q = `SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id=e.category_id WHERE 1=1`;
    const params = [];
    if (from) { q += ` AND e.expense_date >= ?`; params.push(from); }
    if (to) { q += ` AND e.expense_date <= ?`; params.push(to); }
    if (category) { q += ` AND e.category_id=?`; params.push(category); }
    q += ` ORDER BY e.expense_date DESC`;
    const expenses = db.prepare(q).all(...params);
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({ expenses, totalExpenses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #8a: was referencing non-existent table `product_categories` — correct table is `categories`
// Inventory / stock value report
router.get('/inventory', (req, res) => {
  try {
    const { category_id, status } = req.query;
    const db = getDb();
    let q = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1`;
    const params = [];
    if (category_id) { q += ` AND p.category_id=?`; params.push(category_id); }
    if (status) { q += ` AND p.status=?`; params.push(status); }
    q += ` ORDER BY p.name`;
    const products = db.prepare(q).all(...params);
    const totalValue = products.reduce((s, p) => s + ((p.current_stock || 0) * (p.purchase_price || 0)), 0);
    res.json({ products, totalValue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Profit & loss
router.get('/profit-loss', (req, res) => {
  try {
    const { from, to } = req.query;
    const db = getDb();
    const iParams = [], eParams = [];
    let iFilter = `status NOT IN ('Draft','Deleted')`;
    let eFilter = `1=1`;
    if (from) { iFilter += ` AND invoice_date >= ?`; iParams.push(from); eFilter += ` AND expense_date >= ?`; eParams.push(from); }
    if (to) { iFilter += ` AND invoice_date <= ?`; iParams.push(to); eFilter += ` AND expense_date <= ?`; eParams.push(to); }
    const salesTotal = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as t FROM invoices WHERE ${iFilter}`).get(...iParams).t;
    const costTotal = db.prepare(`SELECT COALESCE(SUM(subtotal),0) as t FROM invoices WHERE ${iFilter}`).get(...iParams).t;
    const expenseTotal = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE ${eFilter}`).get(...eParams).t;
    const grossProfit = salesTotal - costTotal;
    const netProfit = grossProfit - expenseTotal;
    res.json({ salesTotal, costTotal, grossProfit, expenseTotal, netProfit });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer outstanding
router.get('/customer-outstanding', (req, res) => {
  try {
    res.json(getDb().prepare(
      `SELECT customer_name, invoice_no, invoice_date, grand_total as total_amount, paid_amount, (grand_total-paid_amount) as balance FROM invoices WHERE is_credit_sale=1 AND status NOT IN ('Draft','Deleted') ORDER BY invoice_date DESC`
    ).all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Vendor outstanding
router.get('/vendor-outstanding', (req, res) => {
  try {
    res.json(getDb().prepare(
      `SELECT v.vendor_name, pi.po_number as bill_no, pi.purchase_date as bill_date, pi.grand_total as total_amount, COALESCE(pi.paid_amount,0) as paid_amount, (pi.grand_total - COALESCE(pi.paid_amount,0)) as balance FROM purchase_invoices pi JOIN vendors v ON v.id=pi.vendor_id WHERE pi.status NOT IN ('Received') ORDER BY pi.purchase_date DESC`
    ).all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Balance sheet
router.get('/balance-sheet', (req, res) => {
  try {
    const db = getDb();
    const cashAccounts = db.prepare(`SELECT account_name, current_balance, is_primary FROM accounts WHERE account_type IN ('Cash','Bank') AND is_active=1`).all();
    const closingStock = db.prepare(`SELECT COALESCE(SUM(current_stock*purchase_price),0) as val FROM products WHERE is_active=1`).get().val;
    const customerOutstanding = db.prepare(`SELECT COALESCE(SUM(grand_total-paid_amount),0) as val FROM invoices WHERE is_credit_sale=1`).get().val;
    const vendorOutstanding = db.prepare(`SELECT COALESCE(SUM(grand_total-COALESCE(paid_amount,0)),0) as val FROM purchase_invoices WHERE status != 'Received'`).get().val;
    const ownerCapital = db.prepare(`SELECT COALESCE(SUM(opening_balance),0) as val FROM accounts WHERE account_type='Capital'`).get().val;
    const totalRevenue = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM invoices WHERE status NOT IN ('Draft','Deleted')`).get().val;
    const totalCost = db.prepare(`SELECT COALESCE(SUM(grand_total),0) as val FROM purchase_invoices WHERE status != 'Pending'`).get().val;
    const totalExpenses = db.prepare(`SELECT COALESCE(SUM(amount),0) as val FROM expenses`).get().val;
    const retainedEarnings = totalRevenue - totalCost - totalExpenses;
    res.json({ cashAccounts, closingStock, customerOutstanding, vendorOutstanding, ownerCapital, retainedEarnings });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #8b: was referencing non-existent `product_categories` — correct table is `categories`
// Stock movement report
router.get('/stock', (req, res) => {
  try {
    res.json(getDb().prepare(
      `SELECT p.name as item_name, c.name as category, p.opening_stock,
        COALESCE((SELECT SUM(qty) FROM purchase_invoice_items WHERE product_id=p.id),0) as purchase_qty,
        COALESCE((SELECT SUM(qty) FROM invoice_items WHERE product_id=p.id),0) as sales_qty,
        p.current_stock, p.purchase_price, p.selling_price,
        ROUND(((p.selling_price-p.purchase_price)/NULLIF(p.selling_price,0))*100,2) as profit_margin
       FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1`
    ).all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Customer ledger — looks up by customer name since invoices store customer_name not customer_id
router.get('/customer-ledger', (req, res) => {
  try {
    const { customer_name } = req.query;
    if (!customer_name) return res.status(400).json({ error: 'customer_name required' });
    const db = getDb();
    const invoices = db.prepare(
      `SELECT * FROM invoices WHERE customer_name LIKE ? ORDER BY invoice_date DESC`
    ).all(`%${customer_name}%`);
    const totalBilled = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
    res.json({ customer_name, invoices, totalBilled, totalPaid, outstanding: totalBilled - totalPaid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

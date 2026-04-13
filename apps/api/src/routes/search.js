const router = require('express').Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ invoices: [], products: [], vendors: [], users: [], expenses: [] });
    const db = getDb();
    const s = `%${q}%`;
    const invoices = db.prepare(`SELECT 'invoice' as type, id, invoice_no, customer_name, grand_total, status, invoice_date as date FROM invoices WHERE invoice_no LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ? LIMIT 5`).all(s, s, s);
    const products = db.prepare(`SELECT 'product' as type, id, sku, name, current_stock, selling_price, status FROM products WHERE (name LIKE ? OR sku LIKE ? OR barcode LIKE ?) AND is_active=1 LIMIT 5`).all(s, s, s);
    const vendors = db.prepare(`SELECT 'vendor' as type, id, vendor_name as name, company_name, phone FROM vendors WHERE vendor_name LIKE ? OR company_name LIKE ? LIMIT 3`).all(s, s);
    const users = db.prepare(`SELECT 'user' as type, id, name, mobile, role, is_active FROM users WHERE name LIKE ? OR mobile LIKE ? LIMIT 3`).all(s, s);
    const expenses = db.prepare(`SELECT 'expense' as type, id, description as name, amount, expense_date as date FROM expenses WHERE description LIKE ? LIMIT 3`).all(s);
    res.json({ invoices, products, vendors, users, expenses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

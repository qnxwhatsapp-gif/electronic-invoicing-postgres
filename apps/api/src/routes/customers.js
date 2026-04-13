const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/customers
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    const db = getDb();
    let q = `SELECT * FROM customers WHERE is_active=1`;
    const params = [];
    if (search) {
      q += ` AND (name LIKE ? OR mobile LIKE ? OR email LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    q += ` ORDER BY name`;
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/customers
// BUG FIX #9c: aligned INSERT columns with the expanded customers schema in database.js
router.post('/', (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return res.json({ success: false, error: 'Name required' });
    const r = getDb().prepare(
      `INSERT INTO customers (name,mobile,email,address,city,state,pincode,gstin,customer_type,opening_balance,credit_limit,credit_days)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      d.name, d.mobile || '', d.email || '', d.address || '',
      d.city || '', d.state || '', d.pincode || '', d.gstin || '',
      d.customer_type || 'Regular', d.opening_balance || 0,
      d.credit_limit || 0, d.credit_days || 30
    );
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/customers/:id
router.put('/:id', (req, res) => {
  try {
    const d = req.body;
    getDb().prepare(
      `UPDATE customers SET name=?,mobile=?,email=?,address=?,city=?,state=?,pincode=?,gstin=?,customer_type=?,credit_limit=?,credit_days=? WHERE id=?`
    ).run(
      d.name, d.mobile || '', d.email || '', d.address || '',
      d.city || '', d.state || '', d.pincode || '', d.gstin || '',
      d.customer_type || 'Regular', d.credit_limit || 0,
      d.credit_days || 30, req.params.id
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/customers/:id  (soft delete)
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`UPDATE customers SET is_active=0 WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/customers/:id/invoices
// BUG FIX #9c: invoices table has no customer_id column — invoices store
// customer_name as plain text. Query by name using the customers record.
router.get('/:id/invoices', (req, res) => {
  try {
    const db = getDb();
    const customer = db.prepare(`SELECT name FROM customers WHERE id=?`).get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const invoices = db.prepare(
      `SELECT * FROM invoices WHERE customer_name = ? ORDER BY invoice_date DESC LIMIT 50`
    ).all(customer.name);
    res.json(invoices);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

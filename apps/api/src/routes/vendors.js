const router = require('express').Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    const db = getDb();
    let q = `SELECT * FROM vendors WHERE 1=1`;
    const params = [];
    if (search) { q += ` AND (vendor_name LIKE ? OR company_name LIKE ?)`; const s = `%${search}%`; params.push(s, s); }
    q += ` ORDER BY vendor_name`;
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const d = req.body;
    const r = getDb().prepare(`INSERT INTO vendors (vendor_name,company_name,email,phone,street_address,city,province_state,postal_code,account_name,account_number) VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(d.vendor_name, d.company_name||'', d.email||'', d.phone||'', d.street_address||'', d.city||'', d.province_state||'', d.postal_code||'', d.account_name||'', d.account_number||'');
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/:id', (req, res) => {
  try {
    const d = req.body;
    getDb().prepare(`UPDATE vendors SET vendor_name=?,company_name=?,email=?,phone=?,street_address=?,city=?,province_state=?,postal_code=?,account_name=?,account_number=? WHERE id=?`
    ).run(d.vendor_name, d.company_name||'', d.email||'', d.phone||'', d.street_address||'', d.city||'', d.province_state||'', d.postal_code||'', d.account_name||'', d.account_number||'', req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`DELETE FROM vendors WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Purchases under vendors
router.get('/:id/purchases', (req, res) => {
  try {
    const purchases = getDb().prepare(`SELECT pi.*, (SELECT COUNT(*) FROM purchase_invoice_items WHERE purchase_invoice_id=pi.id) as product_count FROM purchase_invoices pi WHERE pi.vendor_id=? ORDER BY pi.created_at DESC`).all(req.params.id);
    res.json(purchases);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

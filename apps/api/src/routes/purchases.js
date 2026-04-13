const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/purchases
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    const db = getDb();
    let q = `SELECT pi.*, v.vendor_name, (SELECT COUNT(*) FROM purchase_invoice_items WHERE purchase_invoice_id=pi.id) as product_count, (SELECT COALESCE(SUM(qty),0) FROM purchase_invoice_items WHERE purchase_invoice_id=pi.id) as total_qty FROM purchase_invoices pi LEFT JOIN vendors v ON v.id=pi.vendor_id WHERE 1=1`;
    const params = [];
    if (search) { q += ` AND (pi.po_number LIKE ? OR v.vendor_name LIKE ?)`; const s = `%${search}%`; params.push(s, s); }
    q += ` ORDER BY pi.created_at DESC`;
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #3: /returns MUST come before /:id/items — otherwise Express matches
// "returns" as the :id segment and routes to the wrong handler.

// GET /api/purchases/returns
router.get('/returns', (req, res) => {
  try {
    res.json(getDb().prepare(`SELECT pr.*, v.vendor_name as vname FROM purchase_returns pr LEFT JOIN vendors v ON v.id=pr.vendor_id ORDER BY pr.order_date DESC`).all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/purchases/returns
router.post('/returns', (req, res) => {
  try {
    const db = getDb();
    const data = req.body;
    const r = db.prepare(
      `INSERT INTO purchase_returns (po_number,vendor_id,vendor_name,original_invoice_id,purchased_qty,return_qty,return_total,return_reason,status,order_date) VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).run(
      data.po_number || '', data.vendor_id || null, data.vendor_name || '',
      data.original_invoice_id || null, data.purchased_qty || 0, data.return_qty || 0,
      data.return_total || 0, data.return_reason || '', 'Pending',
      new Date().toISOString().slice(0, 10)
    );
    const returnId = r.lastInsertRowid;
    if (data.items) {
      const ins = db.prepare(`INSERT INTO purchase_return_items (purchase_return_id,product_id,item_name,sku,purchased_qty,return_qty,purchase_price,total) VALUES (?,?,?,?,?,?,?,?)`);
      const upd = db.prepare(`UPDATE products SET current_stock=current_stock-? WHERE id=?`);
      for (const item of data.items) {
        if (item.return_qty > 0) {
          ins.run(returnId, item.product_id, item.item_name || '', item.sku || '', item.purchased_qty || 0, item.return_qty, item.purchase_price || 0, item.return_qty * (item.purchase_price || 0));
          upd.run(item.return_qty, item.product_id);
        }
      }
    }
    res.json({ success: true, id: returnId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/purchases
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const data = req.body;
    const year = new Date().getFullYear();
    const last = db.prepare(`SELECT po_number FROM purchase_invoices ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.po_number.split('-')[2], 10); seq = isNaN(n) ? 1 : n + 1; }
    const po_number = `PO-${year}-${String(seq).padStart(6, '0')}`;
    const vendor = db.prepare(`SELECT vendor_name FROM vendors WHERE id=?`).get(data.vendor_id);
    const vendorName = vendor?.vendor_name || data.vendor_name || '';
    const r = db.prepare(
      `INSERT INTO purchase_invoices (po_number,vendor_id,vendor_name,purchase_date,subtotal,grand_total,purchase_note,status,pending_amount) VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(po_number, data.vendor_id, vendorName, data.purchase_date, data.subtotal, data.grand_total, data.notes || '', data.status || 'Pending', data.grand_total);
    const piId = r.lastInsertRowid;
    if (data.items) {
      const ins = db.prepare(`INSERT INTO purchase_invoice_items (purchase_invoice_id,product_id,product_name,product_code,qty,price,total) VALUES (?,?,?,?,?,?,?)`);
      const upd = db.prepare(`UPDATE products SET current_stock=current_stock+? WHERE id=?`);
      for (const item of data.items) {
        ins.run(piId, item.product_id, item.name || item.product_name, item.sku || item.product_code || '', item.qty, item.rate || item.price, item.amount || item.total);
        if (data.status === 'Received') upd.run(item.qty, item.product_id);
      }
    }
    res.json({ success: true, po_number, id: piId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/purchases/:id/items
router.get('/:id/items', (req, res) => {
  try {
    res.json(getDb().prepare(`SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id=?`).all(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/purchases/:id/status
router.put('/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const pi = db.prepare(`SELECT status FROM purchase_invoices WHERE id=?`).get(req.params.id);
    if (!pi) return res.status(404).json({ success: false, error: 'Not found' });
    db.prepare(`UPDATE purchase_invoices SET status=? WHERE id=?`).run(status, req.params.id);
    if (status === 'Received' && pi.status !== 'Received') {
      const items = db.prepare(`SELECT * FROM purchase_invoice_items WHERE purchase_invoice_id=?`).all(req.params.id);
      const upd = db.prepare(`UPDATE products SET current_stock=current_stock+? WHERE id=?`);
      for (const item of items) upd.run(item.qty, item.product_id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/purchases/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM purchase_invoice_items WHERE purchase_invoice_id=?`).run(req.params.id);
    db.prepare(`DELETE FROM purchase_invoices WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

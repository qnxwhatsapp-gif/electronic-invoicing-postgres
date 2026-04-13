const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/paybills
router.get('/', (req, res) => {
  try {
    const { vendor_id, purchase_invoice_id } = req.query;
    const db = getDb();
    let q = `SELECT pb.*, v.vendor_name FROM pay_bills pb LEFT JOIN vendors v ON v.id=pb.vendor_id WHERE 1=1`;
    const params = [];
    if (vendor_id) { q += ` AND pb.vendor_id=?`; params.push(vendor_id); }
    if (purchase_invoice_id) { q += ` AND pb.purchase_invoice_id=?`; params.push(purchase_invoice_id); }
    q += ` ORDER BY pb.payment_date DESC, pb.id DESC`;
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/paybills
// BUG FIX #9d: aligned INSERT with the simplified pay_bills schema.
// Old schema had: outstanding_amount, total_payable, last_payment_date, paying_amount, payment_status
// New schema uses: amount, reference_no, notes — matching what this route actually sends.
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const d = req.body;
    if (!d.vendor_id || !d.amount) return res.json({ success: false, error: 'vendor_id and amount required' });

    const r = db.prepare(
      `INSERT INTO pay_bills (vendor_id,purchase_invoice_id,amount,payment_mode,payment_date,reference_no,notes)
       VALUES (?,?,?,?,?,?,?)`
    ).run(
      d.vendor_id,
      d.purchase_invoice_id || null,
      d.amount,
      d.payment_mode || 'Cash',
      d.payment_date || new Date().toISOString().slice(0, 10),
      d.reference_no || '',
      d.notes || ''
    );

    // Update purchase invoice pending amount and status if linked
    if (d.purchase_invoice_id) {
      db.prepare(
        `UPDATE purchase_invoices SET pending_amount=MAX(0,pending_amount-?), paid_amount=COALESCE(paid_amount,0)+? WHERE id=?`
      ).run(d.amount, d.amount, d.purchase_invoice_id);

      const pi = db.prepare(`SELECT pending_amount FROM purchase_invoices WHERE id=?`).get(d.purchase_invoice_id);
      if (pi && pi.pending_amount <= 0) {
        db.prepare(`UPDATE purchase_invoices SET status='Paid' WHERE id=?`).run(d.purchase_invoice_id);
      }
    }

    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/paybills/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const bill = db.prepare(`SELECT * FROM pay_bills WHERE id=?`).get(req.params.id);
    if (bill) {
      if (bill.purchase_invoice_id) {
        db.prepare(
          `UPDATE purchase_invoices SET pending_amount=pending_amount+?, paid_amount=MAX(0,COALESCE(paid_amount,0)-?), status='Pending' WHERE id=?`
        ).run(bill.amount, bill.amount, bill.purchase_invoice_id);
      }
      db.prepare(`DELETE FROM pay_bills WHERE id=?`).run(req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db/pg');

// GET /api/paybills
router.get('/', async (req, res) => {
  try {
    const { vendor_id, purchase_invoice_id } = req.query;
    let query = db('pay_bills as pb')
      .leftJoin('vendors as v', 'v.id', 'pb.vendor_id')
      .select('pb.*', 'v.vendor_name');
    if (vendor_id) query = query.where('pb.vendor_id', vendor_id);
    if (purchase_invoice_id) query = query.where('pb.purchase_invoice_id', purchase_invoice_id);
    res.json(await query.orderBy([{ column: 'pb.payment_date', order: 'desc' }, { column: 'pb.id', order: 'desc' }]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/paybills
// BUG FIX #9d: aligned INSERT with the simplified pay_bills schema.
// Old schema had: outstanding_amount, total_payable, last_payment_date, paying_amount, payment_status
// New schema uses: amount, reference_no, notes — matching what this route actually sends.
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    if (!d.vendor_id || !d.amount) return res.json({ success: false, error: 'vendor_id and amount required' });

    const rows = await db('pay_bills').insert({
      vendor_id: d.vendor_id,
      purchase_invoice_id: d.purchase_invoice_id || null,
      amount: d.amount,
      payment_mode: d.payment_mode || 'Cash',
      payment_date: d.payment_date || new Date().toISOString().slice(0, 10),
      reference_no: d.reference_no || '',
      notes: d.notes || '',
    }).returning('id');

    // Update purchase invoice pending amount and status if linked
    if (d.purchase_invoice_id) {
      await db('purchase_invoices').where({ id: d.purchase_invoice_id }).update({
        pending_amount: db.raw('GREATEST(0, pending_amount - ?)', [d.amount]),
        paid_amount: db.raw('COALESCE(paid_amount,0) + ?', [d.amount]),
      });
      const pi = await db('purchase_invoices').select('pending_amount').where({ id: d.purchase_invoice_id }).first();
      if (pi && pi.pending_amount <= 0) {
        await db('purchase_invoices').where({ id: d.purchase_invoice_id }).update({ status: 'Paid' });
      }
    }

    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/paybills/:id
router.delete('/:id', async (req, res) => {
  try {
    const bill = await db('pay_bills').where({ id: req.params.id }).first();
    if (bill) {
      if (bill.purchase_invoice_id) {
        await db('purchase_invoices').where({ id: bill.purchase_invoice_id }).update({
          pending_amount: db.raw('pending_amount + ?', [bill.amount]),
          paid_amount: db.raw('GREATEST(0, COALESCE(paid_amount,0) - ?)', [bill.amount]),
          status: 'Pending',
        });
      }
      await db('pay_bills').where({ id: req.params.id }).del();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

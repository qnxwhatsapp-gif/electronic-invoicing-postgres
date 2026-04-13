const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/invoices
router.get('/', (req, res) => {
  try {
    const { status, search, branch_id } = req.query;
    const db = getDb();
    let q = `SELECT i.*, (SELECT COUNT(*) FROM invoice_items WHERE invoice_id=i.id) as item_count FROM invoices i WHERE 1=1`;
    const params = [];
    if (status) { q += ` AND i.status = ?`; params.push(status); }
    if (branch_id) { q += ` AND i.branch_id = ?`; params.push(branch_id); }
    if (search) {
      q += ` AND (i.invoice_no LIKE ? OR i.customer_name LIKE ? OR CAST(i.grand_total AS TEXT) LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    q += ` ORDER BY i.created_at DESC`;
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #2: /returns and /autocomplete MUST come before /:id or Express
// will treat the literal string "returns" / "autocomplete" as an id parameter.
// GET /api/invoices/returns
router.get('/returns', (req, res) => {
  try { res.json(getDb().prepare(`SELECT * FROM return_exchange ORDER BY date DESC`).all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/returns
router.post('/returns', (req, res) => {
  try {
    const db = getDb();
    const data = req.body;
    if (data.original_invoice_id) {
      const origInv = db.prepare(`SELECT invoice_date, status FROM invoices WHERE id=?`).get(data.original_invoice_id);
      if (origInv) {
        const days = db.prepare(`SELECT CAST(julianday('now') - julianday(?) AS INTEGER) as d`).get(origInv.invoice_date).d;
        if (days > 15) return res.json({ success: false, error: 'Return period of 15 days has expired for this invoice.' });
        if (origInv.status === 'Completed') return res.json({ success: false, error: 'This invoice is completed and cannot be returned.' });
      }
    }
    const r = db.prepare(
      `INSERT INTO return_exchange (original_invoice_id,invoice_no,customer_name,type,total_items_sold,items_returned,return_amount,exchange_amount,net_amount,status,created_by) VALUES (@original_invoice_id,@invoice_no,@customer_name,@type,@total_items_sold,@items_returned,@return_amount,@exchange_amount,@net_amount,@status,@created_by)`
    ).run(data);
    if (data.items) {
      const upd = db.prepare(`UPDATE products SET current_stock=current_stock+? WHERE id=?`);
      for (const item of data.items) if (item.returned_qty > 0) upd.run(item.returned_qty, item.product_id);
    }
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/invoices/autocomplete  (marks overdue credit invoices)
router.post('/autocomplete', (req, res) => {
  try {
    getDb().prepare(`UPDATE invoices SET status='Overdue' WHERE is_credit_sale=1 AND status='Credit' AND due_date < date('now')`).run();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/invoices/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const inv = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    inv.items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(req.params.id);
    res.json(inv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const data = req.body;

    // Read prefix from invoice_settings so it respects user configuration
    const settings = db.prepare(`SELECT inv_prefix, inv_start_number, inv_padding FROM invoice_settings WHERE id=1`).get();
    const prefix = settings?.inv_prefix || 'INV';
    const padding = settings?.inv_padding || 3;

    const last = db.prepare(`SELECT invoice_no FROM invoices ORDER BY id DESC LIMIT 1`).get();
    let seq = settings?.inv_start_number || 1;
    if (last) {
      const num = parseInt(last.invoice_no.replace(prefix, ''), 10);
      if (!isNaN(num)) seq = num + 1;
    }
    const invoice_no = `${prefix}${String(seq).padStart(padding, '0')}`;

    const insert = db.prepare(`
      INSERT INTO invoices (invoice_no,invoice_date,due_date,customer_name,customer_phone,customer_address,
        seller_id,branch_id,subtotal,tax_amount,grand_total,payment_mode,cash_amount,online_amount,
        internal_notes,status,type,is_credit_sale,paid_amount,created_by)
      VALUES (@invoice_no,@invoice_date,@due_date,@customer_name,@customer_phone,@customer_address,
        @seller_id,@branch_id,@subtotal,@tax_amount,@grand_total,@payment_mode,@cash_amount,@online_amount,
        @internal_notes,@status,@type,@is_credit_sale,@paid_amount,@created_by)
    `);
    const result = insert.run({
      invoice_no,
      invoice_date: data.invoice_date,
      due_date: data.due_date || null,
      customer_name: data.customer_name || '',
      customer_phone: data.customer_phone || '',
      customer_address: data.customer_address || '',
      seller_id: data.seller_id || null,
      branch_id: data.branch_id || null,
      subtotal: data.subtotal || 0,
      tax_amount: data.tax_amount || 0,
      grand_total: data.grand_total || 0,
      payment_mode: data.payment_mode || 'Cash',
      cash_amount: data.split_cash || data.cash_amount || null,
      online_amount: data.split_card || data.online_amount || null,
      internal_notes: data.notes || data.internal_notes || '',
      status: data.status || 'Paid',
      type: data.type || 'Sale',
      is_credit_sale: data.is_credit_sale || 0,
      paid_amount: data.is_credit_sale ? 0 : (data.grand_total || 0),
      created_by: data.created_by || null,
    });
    const invoiceId = result.lastInsertRowid;

    if (data.items && data.items.length) {
      const insItem = db.prepare(`INSERT INTO invoice_items (invoice_id,product_id,product_code,product_name,qty,rate,amount) VALUES (?,?,?,?,?,?,?)`);
      const updStock = db.prepare(`UPDATE products SET current_stock = current_stock - ?, status = CASE WHEN current_stock - ? <= 5 THEN 'Critical' WHEN current_stock - ? <= reorder_level THEN 'Low' ELSE 'Good' END WHERE id = ?`);
      for (const item of data.items) {
        insItem.run(invoiceId, item.product_id, item.product_code || item.sku || '', item.product_name || item.name || '', item.qty, item.rate, item.amount);
        if (data.status !== 'Draft') updStock.run(item.qty, item.qty, item.qty, item.product_id);
      }
    }
    res.json({ success: true, invoice_no, id: invoiceId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/invoices/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const data = req.body;
    db.prepare(`
      UPDATE invoices SET invoice_date=@invoice_date,due_date=@due_date,customer_name=@customer_name,
        customer_phone=@customer_phone,customer_address=@customer_address,seller_id=@seller_id,
        branch_id=@branch_id,subtotal=@subtotal,tax_amount=@tax_amount,grand_total=@grand_total,
        payment_mode=@payment_mode,cash_amount=@cash_amount,online_amount=@online_amount,
        internal_notes=@internal_notes,status=@status,type=@type,is_credit_sale=@is_credit_sale,
        paid_amount=@paid_amount,updated_at=datetime('now')
      WHERE id=@id
    `).run({
      id,
      invoice_date: data.invoice_date,
      due_date: data.due_date || null,
      customer_name: data.customer_name || '',
      customer_phone: data.customer_phone || '',
      customer_address: data.customer_address || '',
      seller_id: data.seller_id || null,
      branch_id: data.branch_id || null,
      subtotal: data.subtotal || 0,
      tax_amount: data.tax_amount || 0,
      grand_total: data.grand_total || 0,
      payment_mode: data.payment_mode || 'Cash',
      cash_amount: data.cash_amount || null,
      online_amount: data.online_amount || null,
      internal_notes: data.internal_notes || '',
      status: data.status || 'Draft',
      type: data.type || 'Sale',
      is_credit_sale: data.is_credit_sale || 0,
      paid_amount: data.paid_amount || 0,
    });
    if (data.items) {
      db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(id);
      const ins = db.prepare(`INSERT INTO invoice_items (invoice_id,product_id,product_code,product_name,qty,rate,amount) VALUES (?,?,?,?,?,?,?)`);
      for (const item of data.items) ins.run(id, item.product_id, item.product_code || '', item.product_name || item.name || '', item.qty, item.rate, item.amount);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/invoices/:id/status
router.put('/:id/status', (req, res) => {
  try {
    const { status, paid_amount } = req.body;
    getDb().prepare(`UPDATE invoices SET status=?, paid_amount=COALESCE(?,paid_amount), updated_at=datetime('now') WHERE id=?`).run(status, paid_amount, req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/invoices/:id
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`DELETE FROM invoices WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

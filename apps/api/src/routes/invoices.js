const router = require('express').Router();
const db = require('../db/pg');

// GET /api/invoices
router.get('/', async (req, res) => {
  try {
    const { status, search, branch_id } = req.query;
    let query = db('invoices as i')
      .leftJoin('invoice_items as ii', 'ii.invoice_id', 'i.id')
      .select('i.*')
      .count('ii.id as item_count')
      .groupBy('i.id');
    if (status) query = query.where('i.status', status);
    if (branch_id) query = query.where('i.branch_id', branch_id);
    if (search) {
      const s = `%${search}%`;
      query = query.andWhere((qb) =>
        qb.where('i.invoice_no', 'like', s).orWhere('i.customer_name', 'like', s).orWhereRaw('CAST(i.grand_total AS TEXT) LIKE ?', [s]));
    }
    res.json(await query.orderBy('i.created_at', 'desc'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #2: /returns and /autocomplete MUST come before /:id or Express
// will treat the literal string "returns" / "autocomplete" as an id parameter.
// GET /api/invoices/returns
router.get('/returns', async (req, res) => {
  try { res.json(await db('return_exchange').select('*').orderBy('date', 'desc')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/returns
router.post('/returns', async (req, res) => {
  try {
    const data = req.body;
    if (data.original_invoice_id) {
      const origInv = await db('invoices')
        .select('invoice_date', 'status')
        .where({ id: data.original_invoice_id })
        .first();
      if (origInv) {
        const days = Math.floor((Date.now() - new Date(origInv.invoice_date).getTime()) / (24 * 60 * 60 * 1000));
        if (days > 15) return res.json({ success: false, error: 'Return period of 15 days has expired for this invoice.' });
        if (origInv.status === 'Completed') return res.json({ success: false, error: 'This invoice is completed and cannot be returned.' });
      }
    }
    const rows = await db('return_exchange')
      .insert({
        original_invoice_id: data.original_invoice_id || null,
        invoice_no: data.invoice_no || '',
        customer_name: data.customer_name || '',
        type: data.type,
        total_items_sold: data.total_items_sold || 0,
        items_returned: data.items_returned || 0,
        return_amount: data.return_amount || 0,
        exchange_amount: data.exchange_amount || 0,
        net_amount: data.net_amount || 0,
        status: data.status || 'complete',
        created_by: data.created_by || null,
      })
      .returning('id');
    if (data.items) {
      for (const item of data.items) {
        if (item.returned_qty > 0) {
          await db('products')
            .where({ id: item.product_id })
            .increment('current_stock', item.returned_qty);
        }
      }
    }
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/invoices/autocomplete  (marks overdue credit invoices)
router.post('/autocomplete', async (req, res) => {
  try {
    await db('invoices')
      .where('is_credit_sale', true)
      .andWhere('status', 'Credit')
      .andWhere('due_date', '<', db.fn.now())
      .update({ status: 'Overdue' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/invoices/:id
router.get('/:id', async (req, res) => {
  try {
    const inv = await db('invoices').where({ id: req.params.id }).first();
    if (!inv) return res.status(404).json({ error: 'Not found' });
    inv.items = await db('invoice_items').where({ invoice_id: req.params.id });
    res.json(inv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    // Read prefix from invoice_settings so it respects user configuration
    const settings = await db('invoice_settings')
      .select('inv_prefix', 'inv_start_number', 'inv_padding')
      .where({ id: 1 })
      .first();
    const prefix = settings?.inv_prefix || 'INV';
    const padding = settings?.inv_padding || 3;

    const last = await db('invoices').select('invoice_no').orderBy('id', 'desc').first();
    let seq = settings?.inv_start_number || 1;
    if (last) {
      const num = parseInt(last.invoice_no.replace(prefix, ''), 10);
      if (!isNaN(num)) seq = num + 1;
    }
    const invoice_no = `${prefix}${String(seq).padStart(padding, '0')}`;

    const invoicePayload = {
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
    };
    const invoiceId = await db.transaction(async (trx) => {
      const rows = await trx('invoices').insert(invoicePayload).returning('id');
      const createdInvoiceId = rows[0]?.id;

      if (data.items && data.items.length) {
        for (const item of data.items) {
          await trx('invoice_items').insert({
            invoice_id: createdInvoiceId,
            product_id: item.product_id,
            product_code: item.product_code || item.sku || '',
            product_name: item.product_name || item.name || '',
            qty: item.qty,
            rate: item.rate,
            amount: item.amount,
          });

          if (data.status !== 'Draft') {
            const product = await trx('products')
              .select('current_stock', 'reorder_level')
              .where({ id: item.product_id })
              .first();
            if (product) {
              const nextStock = Number(product.current_stock || 0) - Number(item.qty || 0);
              const statusVal = nextStock <= 5 ? 'Critical' : nextStock <= Number(product.reorder_level || 10) ? 'Low' : 'Good';
              await trx('products').where({ id: item.product_id }).update({ current_stock: nextStock, status: statusVal });
            }
          }
        }
      }
      return createdInvoiceId;
    });
    res.json({ success: true, invoice_no, id: invoiceId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/invoices/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    await db('invoices')
      .where({ id })
      .update({
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
      updated_at: db.fn.now(),
    });
    if (data.items) {
      await db('invoice_items').where({ invoice_id: id }).del();
      for (const item of data.items) {
        await db('invoice_items').insert({
          invoice_id: id,
          product_id: item.product_id,
          product_code: item.product_code || '',
          product_name: item.product_name || item.name || '',
          qty: item.qty,
          rate: item.rate,
          amount: item.amount,
        });
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/invoices/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, paid_amount } = req.body;
    const updatePayload = { status, updated_at: db.fn.now() };
    if (paid_amount !== undefined && paid_amount !== null) updatePayload.paid_amount = paid_amount;
    await db('invoices').where({ id: req.params.id }).update(updatePayload);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/invoices/:id
router.delete('/:id', async (req, res) => {
  try {
    await db('invoices').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

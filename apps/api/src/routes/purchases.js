const router = require('express').Router();
const db = require('../db/pg');

// GET /api/purchases
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = db('purchase_invoices as pi')
      .leftJoin('vendors as v', 'v.id', 'pi.vendor_id')
      .leftJoin('purchase_invoice_items as pii', 'pii.purchase_invoice_id', 'pi.id')
      .select('pi.*', 'v.vendor_name')
      .count('pii.id as product_count')
      .sum('pii.qty as total_qty')
      .groupBy('pi.id', 'v.vendor_name');
    if (search) {
      const s = `%${search}%`;
      query = query.where((qb) => qb.where('pi.po_number', 'like', s).orWhere('v.vendor_name', 'like', s));
    }
    res.json(await query.orderBy('pi.created_at', 'desc'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #3: /returns MUST come before /:id/items — otherwise Express matches
// "returns" as the :id segment and routes to the wrong handler.

// GET /api/purchases/returns
router.get('/returns', async (req, res) => {
  try {
    const rows = await db('purchase_returns as pr')
      .leftJoin('vendors as v', 'v.id', 'pr.vendor_id')
      .select('pr.*', 'v.vendor_name as vname')
      .orderBy('pr.order_date', 'desc');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/purchases/returns
router.post('/returns', async (req, res) => {
  try {
    const data = req.body;
    const returnId = await db.transaction(async (trx) => {
      const rows = await trx('purchase_returns')
        .insert({
          po_number: data.po_number || '',
          vendor_id: data.vendor_id || null,
          vendor_name: data.vendor_name || '',
          original_invoice_id: data.original_invoice_id || null,
          purchased_qty: data.purchased_qty || 0,
          return_qty: data.return_qty || 0,
          return_total: data.return_total || 0,
          return_reason: data.return_reason || '',
          status: 'Pending',
          order_date: new Date().toISOString().slice(0, 10),
        })
        .returning('id');
      const createdId = rows[0]?.id;
      if (data.items) {
        for (const item of data.items) {
          if (item.return_qty > 0) {
            await trx('purchase_return_items').insert({
              purchase_return_id: createdId,
              product_id: item.product_id,
              item_name: item.item_name || '',
              sku: item.sku || '',
              purchased_qty: item.purchased_qty || 0,
              return_qty: item.return_qty,
              purchase_price: item.purchase_price || 0,
              total: Number(item.return_qty) * Number(item.purchase_price || 0),
            });
            await trx('products').where({ id: item.product_id }).decrement('current_stock', item.return_qty);
          }
        }
      }
      return createdId;
    });
    res.json({ success: true, id: returnId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/purchases
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const year = new Date().getFullYear();
    const last = await db('purchase_invoices').select('po_number').orderBy('id', 'desc').first();
    let seq = 1;
    if (last?.po_number) {
      const n = parseInt(last.po_number.split('-')[2], 10);
      seq = isNaN(n) ? 1 : n + 1;
    }
    const po_number = `PO-${year}-${String(seq).padStart(6, '0')}`;
    const vendor = await db('vendors').select('vendor_name').where({ id: data.vendor_id }).first();
    const vendorName = vendor?.vendor_name || data.vendor_name || '';
    const piId = await db.transaction(async (trx) => {
      const rows = await trx('purchase_invoices')
        .insert({
          po_number,
          vendor_id: data.vendor_id,
          vendor_name: vendorName,
          purchase_date: data.purchase_date,
          subtotal: data.subtotal,
          grand_total: data.grand_total,
          purchase_note: data.notes || '',
          status: data.status || 'Pending',
          pending_amount: data.grand_total,
        })
        .returning('id');
      const createdId = rows[0]?.id;
      if (data.items) {
        for (const item of data.items) {
          await trx('purchase_invoice_items').insert({
            purchase_invoice_id: createdId,
            product_id: item.product_id,
            product_name: item.name || item.product_name,
            product_code: item.sku || item.product_code || '',
            qty: item.qty,
            price: item.rate || item.price,
            total: item.amount || item.total,
          });
          if (data.status === 'Received') {
            await trx('products').where({ id: item.product_id }).increment('current_stock', item.qty);
          }
        }
      }
      return createdId;
    });
    res.json({ success: true, po_number, id: piId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/purchases/:id/items
router.get('/:id/items', async (req, res) => {
  try {
    res.json(await db('purchase_invoice_items').where({ purchase_invoice_id: req.params.id }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/purchases/:id/status
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const pi = await db('purchase_invoices').select('status').where({ id: req.params.id }).first();
    if (!pi) return res.status(404).json({ success: false, error: 'Not found' });
    await db('purchase_invoices').where({ id: req.params.id }).update({ status });
    if (status === 'Received' && pi.status !== 'Received') {
      const items = await db('purchase_invoice_items').where({ purchase_invoice_id: req.params.id });
      for (const item of items) {
        await db('products').where({ id: item.product_id }).increment('current_stock', item.qty);
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/purchases/:id
router.delete('/:id', async (req, res) => {
  try {
    await db('purchase_invoice_items').where({ purchase_invoice_id: req.params.id }).del();
    await db('purchase_invoices').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

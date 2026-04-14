const router = require('express').Router();
const db = require('../db/pg');

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = db('vendors').select('*');
    if (search) {
      const s = `%${search}%`;
      query = query.where((qb) => qb.where('vendor_name', 'like', s).orWhere('company_name', 'like', s));
    }
    res.json(await query.orderBy('vendor_name'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const rows = await db('vendors')
      .insert({
        vendor_name: d.vendor_name,
        company_name: d.company_name || '',
        email: d.email || '',
        phone: d.phone || '',
        street_address: d.street_address || '',
        city: d.city || '',
        province_state: d.province_state || '',
        postal_code: d.postal_code || '',
        account_name: d.account_name || '',
        account_number: d.account_number || '',
      })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    await db('vendors')
      .where({ id: req.params.id })
      .update({
        vendor_name: d.vendor_name,
        company_name: d.company_name || '',
        email: d.email || '',
        phone: d.phone || '',
        street_address: d.street_address || '',
        city: d.city || '',
        province_state: d.province_state || '',
        postal_code: d.postal_code || '',
        account_name: d.account_name || '',
        account_number: d.account_number || '',
      });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db('vendors').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// Purchases under vendors
router.get('/:id/purchases', async (req, res) => {
  try {
    const purchases = await db('purchase_invoices as pi')
      .leftJoin('purchase_invoice_items as pii', 'pii.purchase_invoice_id', 'pi.id')
      .where('pi.vendor_id', req.params.id)
      .groupBy('pi.id')
      .select('pi.*')
      .count('pii.id as product_count')
      .orderBy('pi.created_at', 'desc');
    res.json(purchases);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

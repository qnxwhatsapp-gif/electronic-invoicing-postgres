const router = require('express').Router();
const db = require('../db/pg');

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = db('customers').where('is_active', true);
    if (search) {
      const s = `%${search}%`;
      query = query.andWhere((qb) => qb.where('name', 'like', s).orWhere('mobile', 'like', s).orWhere('email', 'like', s));
    }
    const customers = await query.orderBy('name');
    res.json(customers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/customers
// BUG FIX #9c: aligned INSERT columns with the expanded customers schema in database.js
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return res.json({ success: false, error: 'Name required' });
    const rows = await db('customers')
      .insert({
        name: d.name,
        mobile: d.mobile || '',
        email: d.email || '',
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        pincode: d.pincode || '',
        gstin: d.gstin || '',
        customer_type: d.customer_type || 'Regular',
        opening_balance: d.opening_balance || 0,
        credit_limit: d.credit_limit || 0,
        credit_days: d.credit_days || 30,
      })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    await db('customers')
      .where({ id: req.params.id })
      .update({
        name: d.name,
        mobile: d.mobile || '',
        email: d.email || '',
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        pincode: d.pincode || '',
        gstin: d.gstin || '',
        customer_type: d.customer_type || 'Regular',
        credit_limit: d.credit_limit || 0,
        credit_days: d.credit_days || 30,
      });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/customers/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db('customers').where({ id: req.params.id }).update({ is_active: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/customers/:id/invoices
// BUG FIX #9c: invoices table has no customer_id column — invoices store
// customer_name as plain text. Query by name using the customers record.
router.get('/:id/invoices', async (req, res) => {
  try {
    const customer = await db('customers').select('name').where({ id: req.params.id }).first();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const invoices = await db('invoices')
      .where({ customer_name: customer.name })
      .orderBy('invoice_date', 'desc')
      .limit(50);
    res.json(invoices);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

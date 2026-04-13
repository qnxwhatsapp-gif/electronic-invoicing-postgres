const router = require('express').Router();
const db = require('../db/pg');

// GET /api/branches
router.get('/', async (req, res) => {
  try { res.json(await db('branches').where('is_active', true).orderBy('name')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/branches
// BUG FIX #9b: aligned INSERT columns with the expanded branches schema.
// Old schema only had: name, store_id, address, is_active
// Expanded schema now includes city, state, phone, email, gstin.
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return res.json({ success: false, error: 'Name required' });
    const rows = await db('branches')
      .insert({
        name: d.name,
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        phone: d.phone || '',
        email: d.email || '',
        gstin: d.gstin || '',
        is_active: true,
      })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/branches/:id
router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    await db('branches')
      .where({ id: req.params.id })
      .update({
        name: d.name,
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
        phone: d.phone || '',
        email: d.email || '',
        gstin: d.gstin || '',
        is_active: d.is_active ?? true,
      });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/branches/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db('branches').where({ id: req.params.id }).update({ is_active: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

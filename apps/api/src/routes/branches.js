const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/branches
router.get('/', (req, res) => {
  try { res.json(getDb().prepare(`SELECT * FROM branches WHERE is_active=1 ORDER BY name`).all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/branches
// BUG FIX #9b: aligned INSERT columns with the expanded branches schema.
// Old schema only had: name, store_id, address, is_active
// Expanded schema now includes city, state, phone, email, gstin.
router.post('/', (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return res.json({ success: false, error: 'Name required' });
    const r = getDb().prepare(
      `INSERT INTO branches (name,address,city,state,phone,email,gstin,is_active) VALUES (?,?,?,?,?,?,?,1)`
    ).run(
      d.name, d.address || '', d.city || '', d.state || '',
      d.phone || '', d.email || '', d.gstin || ''
    );
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/branches/:id
router.put('/:id', (req, res) => {
  try {
    const d = req.body;
    getDb().prepare(
      `UPDATE branches SET name=?,address=?,city=?,state=?,phone=?,email=?,gstin=?,is_active=? WHERE id=?`
    ).run(
      d.name, d.address || '', d.city || '', d.state || '',
      d.phone || '', d.email || '', d.gstin || '', d.is_active ?? 1,
      req.params.id
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/branches/:id  (soft delete)
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`UPDATE branches SET is_active=0 WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

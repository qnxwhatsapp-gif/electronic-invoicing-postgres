const router = require('express').Router();
const db = require('../db/pg');

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const { user_id, unread_only } = req.query;
    let query = db('notifications').select('*');
    if (user_id) query = query.where((qb) => qb.where('user_id', user_id).orWhereNull('user_id'));
    if (unread_only === '1') query = query.where('is_read', false);
    res.json(await query.orderBy('created_at', 'desc').limit(50));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #6: PUT /mark-all-read MUST come before PUT /:id/read.
// Previously Express matched "mark-all-read" as :id and routed it to the
// single-read handler, which tried to UPDATE WHERE id='mark-all-read' — a no-op.

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (user_id) {
      await db('notifications').where((qb) => qb.where('user_id', user_id).orWhereNull('user_id')).update({ is_read: true });
    } else {
      await db('notifications').update({ is_read: true });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    await db('notifications').where({ id: req.params.id }).update({ is_read: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/notifications
// BUG FIX #9e: aligned columns with expanded notifications schema (user_id, reference_id, reference_type)
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const rows = await db('notifications').insert({
      type: d.type || 'info',
      title: d.title || '',
      message: d.message || '',
      user_id: d.user_id || null,
      reference_id: d.reference_id || null,
      reference_type: d.reference_type || null,
      link: d.link || null,
    }).returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    await db('notifications').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

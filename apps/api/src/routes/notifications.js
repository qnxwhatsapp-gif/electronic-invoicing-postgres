const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/notifications
router.get('/', (req, res) => {
  try {
    const { user_id, unread_only } = req.query;
    const db = getDb();
    let q = `SELECT * FROM notifications WHERE 1=1`;
    const params = [];
    if (user_id) { q += ` AND (user_id=? OR user_id IS NULL)`; params.push(user_id); }
    if (unread_only === '1') { q += ` AND is_read=0`; }
    q += ` ORDER BY created_at DESC LIMIT 50`;
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #6: PUT /mark-all-read MUST come before PUT /:id/read.
// Previously Express matched "mark-all-read" as :id and routed it to the
// single-read handler, which tried to UPDATE WHERE id='mark-all-read' — a no-op.

// PUT /api/notifications/mark-all-read
router.put('/mark-all-read', (req, res) => {
  try {
    const { user_id } = req.body;
    const db = getDb();
    if (user_id) {
      db.prepare(`UPDATE notifications SET is_read=1 WHERE user_id=? OR user_id IS NULL`).run(user_id);
    } else {
      db.prepare(`UPDATE notifications SET is_read=1`).run();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  try {
    getDb().prepare(`UPDATE notifications SET is_read=1 WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/notifications
// BUG FIX #9e: aligned columns with expanded notifications schema (user_id, reference_id, reference_type)
router.post('/', (req, res) => {
  try {
    const d = req.body;
    const r = getDb().prepare(
      `INSERT INTO notifications (type,title,message,user_id,reference_id,reference_type,link) VALUES (?,?,?,?,?,?,?)`
    ).run(d.type || 'info', d.title || '', d.message || '', d.user_id || null, d.reference_id || null, d.reference_type || null, d.link || null);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`DELETE FROM notifications WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

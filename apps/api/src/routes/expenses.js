const router = require('express').Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const { search, category, from, to } = req.query;
    const db = getDb();
    let q = `SELECT e.*, ec.name as category_name FROM expenses e LEFT JOIN expense_categories ec ON ec.id=e.category_id WHERE 1=1`;
    const params = [];
    if (search) { q += ` AND (e.description LIKE ? OR ec.name LIKE ?)`; const s=`%${search}%`; params.push(s,s); }
    if (category) { q += ` AND e.category_id=?`; params.push(category); }
    if (from) { q += ` AND e.expense_date >= ?`; params.push(from); }
    if (to) { q += ` AND e.expense_date <= ?`; params.push(to); }
    q += ` ORDER BY e.expense_date DESC, e.id DESC`;
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', (req, res) => {
  try {
    const d = req.body;
    const db = getDb();
    const cat = db.prepare(`SELECT name FROM expense_categories WHERE id=?`).get(d.category_id);
    const r = db.prepare(`INSERT INTO expenses (category_id,category_name,amount,payment_mode,description,expense_date,created_by) VALUES (?,?,?,?,?,?,?)`
    ).run(d.category_id||null, cat?.name||'', d.amount||0, d.payment_mode||'Cash', d.description||'', d.expense_date||new Date().toISOString().slice(0,10), d.created_by||null);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`DELETE FROM expenses WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const month = new Date().toISOString().slice(0, 7);
    const total = db.prepare(`SELECT COALESCE(SUM(amount),0) as val FROM expenses WHERE expense_date LIKE ?`).get(`${month}%`).val;
    const byCategory = db.prepare(`SELECT ec.name as category, COALESCE(SUM(e.amount),0) as total FROM expenses e LEFT JOIN expense_categories ec ON ec.id=e.category_id WHERE e.expense_date LIKE ? GROUP BY e.category_id`).all(`${month}%`);
    res.json({ total, byCategory });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/categories', (req, res) => {
  try { res.json(getDb().prepare(`SELECT * FROM expense_categories WHERE is_active=1 ORDER BY name`).all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/categories', (req, res) => {
  try {
    const r = getDb().prepare(`INSERT INTO expense_categories (name) VALUES (?)`).run(req.body.name);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

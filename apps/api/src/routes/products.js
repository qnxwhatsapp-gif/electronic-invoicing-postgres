const router = require('express').Router();
const { getDb } = require('../db/database');

// GET /api/products
router.get('/', (req, res) => {
  try {
    const { search, category, status } = req.query;
    const db = getDb();
    let q = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.is_active=1`;
    const params = [];
    if (search) { q += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`; const s = `%${search}%`; params.push(s, s, s); }
    if (category && category !== 'All Categories') { q += ` AND c.name = ?`; params.push(category); }
    if (status && status !== 'All Status') { q += ` AND p.status = ?`; params.push(status); }
    res.json(db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #5: /barcode/:barcode and /categories/* MUST come before /:id.
// Previously /categories was after PUT /:id and DELETE /:id — Express caught
// "categories" as the :id segment on all GET /categories requests.

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', (req, res) => {
  try {
    const p = getDb().prepare(
      `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.barcode=? AND p.is_active=1`
    ).get(req.params.barcode);
    res.json(p || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/products/categories
router.get('/categories', (req, res) => {
  try { res.json(getDb().prepare(`SELECT * FROM categories WHERE is_active=1 ORDER BY name`).all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/products/categories
router.post('/categories', (req, res) => {
  try {
    const r = getDb().prepare(`INSERT INTO categories (name, description) VALUES (?,?)`).run(req.body.name, req.body.description || '');
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/products/categories/:id
router.put('/categories/:id', (req, res) => {
  try {
    getDb().prepare(`UPDATE categories SET name=?, description=? WHERE id=?`).run(req.body.name, req.body.description || '', req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/products/categories/:id
router.delete('/categories/:id', (req, res) => {
  try {
    getDb().prepare(`UPDATE categories SET is_active=0 WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/products
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const data = req.body;
    const last = db.prepare(`SELECT sku FROM products ORDER BY id DESC LIMIT 1`).get();
    let seq = 1;
    if (last) { const n = parseInt(last.sku.replace('ITM-', ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const sku = data.sku || `ITM-${String(seq).padStart(3, '0')}`;
    const initStock = data.current_stock || data.opening_stock || 0;
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    const status = initStock <= 5 ? 'Critical' : initStock <= reorderLvl ? 'Low' : 'Good';
    const r = db.prepare(
      `INSERT INTO products (name,sku,barcode,category_id,purchase_price,selling_price,current_stock,opening_stock,reorder_level,status,description) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(data.name, sku, data.barcode || null, data.category_id || null, data.purchase_price || 0, data.selling_price || 0, initStock, initStock, reorderLvl, status, data.description || '');
    res.json({ success: true, id: r.lastInsertRowid, sku });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/products/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const data = req.body;
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    const stock = data.current_stock || 0;
    const status = stock <= 5 ? 'Critical' : stock <= reorderLvl ? 'Low' : 'Good';
    db.prepare(
      `UPDATE products SET name=?,barcode=?,category_id=?,purchase_price=?,selling_price=?,current_stock=?,reorder_level=?,status=?,description=? WHERE id=?`
    ).run(data.name, data.barcode || null, data.category_id || null, data.purchase_price || 0, data.selling_price || 0, stock, reorderLvl, status, data.description || '', req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`UPDATE products SET is_active=0 WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

const router = require('express').Router();
const db = require('../db/pg');

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let query = db('products as p')
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .select('p.*', 'c.name as category_name')
      .where('p.is_active', true);
    if (search) {
      const s = `%${search}%`;
      query = query.andWhere((qb) => qb.where('p.name', 'like', s).orWhere('p.sku', 'like', s).orWhere('p.barcode', 'like', s));
    }
    if (category && category !== 'All Categories') query = query.andWhere('c.name', category);
    if (status && status !== 'All Status') query = query.andWhere('p.status', status);
    res.json(await query);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// BUG FIX #5: /barcode/:barcode and /categories/* MUST come before /:id.
// Previously /categories was after PUT /:id and DELETE /:id — Express caught
// "categories" as the :id segment on all GET /categories requests.

// GET /api/products/barcode/:barcode
router.get('/barcode/:barcode', async (req, res) => {
  try {
    const p = await db('products as p')
      .leftJoin('categories as c', 'c.id', 'p.category_id')
      .select('p.*', 'c.name as category_name')
      .where({ 'p.barcode': req.params.barcode, 'p.is_active': true })
      .first();
    res.json(p || null);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/products/categories
router.get('/categories', async (req, res) => {
  try { res.json(await db('categories').where('is_active', true).orderBy('name')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/products/categories
router.post('/categories', async (req, res) => {
  try {
    const rows = await db('categories')
      .insert({ name: req.body.name, description: req.body.description || '' })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/products/categories/:id
router.put('/categories/:id', async (req, res) => {
  try {
    await db('categories').where({ id: req.params.id }).update({ name: req.body.name, description: req.body.description || '' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/products/categories/:id
router.delete('/categories/:id', async (req, res) => {
  try {
    await db('categories').where({ id: req.params.id }).update({ is_active: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const last = await db('products').select('sku').orderBy('id', 'desc').first();
    let seq = 1;
    if (last) { const n = parseInt(last.sku.replace('ITM-', ''), 10); seq = isNaN(n) ? 1 : n + 1; }
    const sku = data.sku || `ITM-${String(seq).padStart(3, '0')}`;
    const initStock = data.current_stock || data.opening_stock || 0;
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    const status = initStock <= 5 ? 'Critical' : initStock <= reorderLvl ? 'Low' : 'Good';
    const rows = await db('products')
      .insert({
        name: data.name,
        sku,
        barcode: data.barcode || null,
        category_id: data.category_id || null,
        purchase_price: data.purchase_price || 0,
        selling_price: data.selling_price || 0,
        current_stock: initStock,
        opening_stock: initStock,
        reorder_level: reorderLvl,
        status,
        description: data.description || '',
      })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id, sku });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    const reorderLvl = data.low_stock_threshold || data.reorder_level || 10;
    const stock = data.current_stock || 0;
    const status = stock <= 5 ? 'Critical' : stock <= reorderLvl ? 'Low' : 'Good';
    await db('products')
      .where({ id: req.params.id })
      .update({
        name: data.name,
        barcode: data.barcode || null,
        category_id: data.category_id || null,
        purchase_price: data.purchase_price || 0,
        selling_price: data.selling_price || 0,
        current_stock: stock,
        reorder_level: reorderLvl,
        status,
        description: data.description || '',
      });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/products/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db('products').where({ id: req.params.id }).update({ is_active: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

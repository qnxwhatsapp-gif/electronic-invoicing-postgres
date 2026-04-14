const router = require('express').Router();
const db = require('../db/pg');

router.get('/', async (req, res) => {
  try {
    const { search, category, from, to } = req.query;
    let query = db('expenses as e')
      .leftJoin('expense_categories as ec', 'ec.id', 'e.category_id')
      .select('e.*', 'ec.name as category_name');
    if (search) { const s = `%${search}%`; query = query.where((qb) => qb.where('e.description', 'like', s).orWhere('ec.name', 'like', s)); }
    if (category) query = query.where('e.category_id', category);
    if (from) query = query.where('e.expense_date', '>=', from);
    if (to) query = query.where('e.expense_date', '<=', to);
    res.json(await query.orderBy([{ column: 'e.expense_date', order: 'desc' }, { column: 'e.id', order: 'desc' }]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const cat = await db('expense_categories').select('name').where({ id: d.category_id }).first();
    const rows = await db('expenses')
      .insert({
        category_id: d.category_id || null,
        category_name: cat?.name || '',
        amount: d.amount || 0,
        payment_mode: d.payment_mode || 'Cash',
        description: d.description || '',
        expense_date: d.expense_date || new Date().toISOString().slice(0, 10),
        created_by: d.created_by || null,
      })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db('expenses').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const totalRow = await db('expenses')
      .where('expense_date', 'like', `${month}%`)
      .sum('amount as val')
      .first();
    const total = Number(totalRow?.val || 0);
    const byCategory = await db('expenses as e')
      .leftJoin('expense_categories as ec', 'ec.id', 'e.category_id')
      .where('e.expense_date', 'like', `${month}%`)
      .groupBy('e.category_id', 'ec.name')
      .select('ec.name as category')
      .sum('e.amount as total');
    res.json({ total, byCategory });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/categories', async (req, res) => {
  try { res.json(await db('expense_categories').where('is_active', true).orderBy('name')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/categories', async (req, res) => {
  try {
    const rows = await db('expense_categories').insert({ name: req.body.name }).returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

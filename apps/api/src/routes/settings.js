const router = require('express').Router();
const db = require('../db/pg');

router.get('/', async (req, res) => {
  try {
    const rows = await db('app_settings').select('key', 'value');
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await db('app_settings').insert({ key, value: String(value) }).onConflict('key').merge();
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/:key', async (req, res) => {
  try {
    const row = await db('app_settings').select('value').where({ key: req.params.key }).first();
    res.json({ key: req.params.key, value: row?.value ?? null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

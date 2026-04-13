const router = require('express').Router();
const { getDb } = require('../db/database');

router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare(`SELECT key, value FROM app_settings`).all();
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/', (req, res) => {
  try {
    const db = getDb();
    const upsert = db.prepare(`INSERT INTO app_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) upsert.run(key, String(value));
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/:key', (req, res) => {
  try {
    const row = getDb().prepare(`SELECT value FROM app_settings WHERE key=?`).get(req.params.key);
    res.json({ key: req.params.key, value: row?.value ?? null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

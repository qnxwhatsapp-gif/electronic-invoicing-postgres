const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDb();
    const user = db.prepare(`SELECT * FROM users WHERE (name = ? OR mobile = ?) AND is_active = 1`).get(username, username);
    if (!user) return res.json({ success: false, error: 'Invalid username or password.' });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ success: false, error: 'Invalid username or password.' });
    const { password: _pw, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/auth/roles
router.get('/roles', (req, res) => {
  try {
    const roles = getDb().prepare(`SELECT DISTINCT role FROM users WHERE is_active = 1 ORDER BY role`).all().map(r => r.role);
    res.json(roles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/users-by-role?role=Owner
router.get('/users-by-role', (req, res) => {
  try {
    const { role } = req.query;
    const users = getDb().prepare(`SELECT id, name, mobile FROM users WHERE role = ? AND is_active = 1 ORDER BY name`).all(role);
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

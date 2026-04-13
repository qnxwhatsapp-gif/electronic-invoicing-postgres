const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/pg');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db('users')
      .where((q) => q.where('name', username).orWhere('mobile', username))
      .andWhere('is_active', true)
      .first();
    if (!user) return res.json({ success: false, error: 'Invalid username or password.' });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ success: false, error: 'Invalid username or password.' });
    const { password: _pw, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/auth/roles
router.get('/roles', async (req, res) => {
  try {
    const rows = await db('users').distinct('role').where('is_active', true).orderBy('role');
    const roles = rows.map((r) => r.role);
    res.json(roles);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/users-by-role?role=Owner
router.get('/users-by-role', async (req, res) => {
  try {
    const { role } = req.query;
    const users = await db('users')
      .select('id', 'name', 'mobile')
      .where({ role, is_active: true })
      .orderBy('name');
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');

// BUG FIX #4: Roles routes MUST come before /:id routes.
// Previously GET /roles/all, POST /roles/create, DELETE /roles/:id were after
// GET /:id — Express was matching "roles" as the :id parameter on every call.

// GET /api/users/roles/all
router.get('/roles/all', (req, res) => {
  try { res.json(getDb().prepare(`SELECT * FROM user_roles ORDER BY is_system DESC, name ASC`).all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/roles/create
router.post('/roles/create', (req, res) => {
  try {
    getDb().prepare(`INSERT INTO user_roles (name, is_system) VALUES (?, 0)`).run(req.body.name.trim());
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: 'Role already exists' }); }
});

// DELETE /api/users/roles/:id
router.delete('/roles/:id', (req, res) => {
  try {
    const db = getDb();
    const role = db.prepare(`SELECT * FROM user_roles WHERE id=?`).get(req.params.id);
    if (!role) return res.json({ success: false, error: 'Not found' });
    if (role.is_system) return res.json({ success: false, error: 'Cannot delete system role' });
    db.prepare(`DELETE FROM user_roles WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/users
router.get('/', (req, res) => {
  try {
    const users = getDb().prepare(`SELECT id,name,mobile,email,role,branch_id,is_active,created_at FROM users ORDER BY name`).all();
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users
router.post('/', (req, res) => {
  try {
    const d = req.body;
    if (!d.name || !d.mobile || !d.password) return res.json({ success: false, error: 'Name, mobile and password required' });
    const hash = bcrypt.hashSync(d.password, 10);
    const r = getDb().prepare(
      `INSERT INTO users (name,mobile,email,password,role,branch_id) VALUES (?,?,?,?,?,?)`
    ).run(d.name, d.mobile, d.email || '', hash, d.role || 'Staff', d.branch_id || null);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/users/:id/permissions
router.get('/:id/permissions', (req, res) => {
  try {
    res.json(getDb().prepare(`SELECT * FROM user_permissions WHERE user_id=?`).all(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/users/:id/permissions
router.put('/:id/permissions', (req, res) => {
  try {
    const db = getDb();
    const { permissions } = req.body;
    const upsert = db.prepare(
      `INSERT INTO user_permissions (user_id,module,can_view,can_create,can_edit,can_delete) VALUES (?,?,?,?,?,?)
       ON CONFLICT(user_id,module) DO UPDATE SET can_view=excluded.can_view,can_create=excluded.can_create,can_edit=excluded.can_edit,can_delete=excluded.can_delete`
    );
    for (const p of permissions) upsert.run(req.params.id, p.module, p.can_view || 0, p.can_create || 0, p.can_edit || 0, p.can_delete || 0);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/users/:id
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const d = req.body;
    if (d.password) {
      const hash = bcrypt.hashSync(d.password, 10);
      db.prepare(`UPDATE users SET name=?,mobile=?,email=?,role=?,branch_id=?,is_active=?,password=? WHERE id=?`
      ).run(d.name, d.mobile, d.email || '', d.role || 'Staff', d.branch_id || null, d.is_active ?? 1, hash, req.params.id);
    } else {
      db.prepare(`UPDATE users SET name=?,mobile=?,email=?,role=?,branch_id=?,is_active=? WHERE id=?`
      ).run(d.name, d.mobile, d.email || '', d.role || 'Staff', d.branch_id || null, d.is_active ?? 1, req.params.id);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/users/:id  (soft delete)
router.delete('/:id', (req, res) => {
  try {
    getDb().prepare(`UPDATE users SET is_active=0 WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

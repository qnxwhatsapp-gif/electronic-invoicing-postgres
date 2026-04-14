const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db/pg');

// BUG FIX #4: Roles routes MUST come before /:id routes.
// Previously GET /roles/all, POST /roles/create, DELETE /roles/:id were after
// GET /:id — Express was matching "roles" as the :id parameter on every call.

// GET /api/users/roles/all
router.get('/roles/all', async (req, res) => {
  try { res.json(await db('user_roles').select('*').orderBy([{ column: 'is_system', order: 'desc' }, { column: 'name', order: 'asc' }])); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/roles/create
router.post('/roles/create', async (req, res) => {
  try {
    await db('user_roles').insert({ name: req.body.name.trim(), is_system: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: 'Role already exists' }); }
});

// DELETE /api/users/roles/:id
router.delete('/roles/:id', async (req, res) => {
  try {
    const role = await db('user_roles').where({ id: req.params.id }).first();
    if (!role) return res.json({ success: false, error: 'Not found' });
    if (role.is_system) return res.json({ success: false, error: 'Cannot delete system role' });
    await db('user_roles').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await db('users')
      .select('id', 'name', 'mobile', 'email', 'role', 'branch_id', 'is_active', 'created_at')
      .orderBy('name');
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    if (!d.name || !d.mobile || !d.password) return res.json({ success: false, error: 'Name, mobile and password required' });
    const hash = bcrypt.hashSync(d.password, 10);
    const rows = await db('users')
      .insert({
        name: d.name,
        mobile: d.mobile,
        email: d.email || '',
        password: hash,
        role: d.role || 'Staff',
        branch_id: d.branch_id || null,
      })
      .returning('id');
    res.json({ success: true, id: rows[0]?.id });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/users/:id/permissions
router.get('/:id/permissions', async (req, res) => {
  try {
    const permissions = await db('user_permissions').where({ user_id: req.params.id });
    res.json(permissions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/users/:id/permissions
router.put('/:id/permissions', async (req, res) => {
  try {
    const { permissions } = req.body;
    for (const p of permissions) {
      await db('user_permissions')
        .insert({
          user_id: req.params.id,
          module: p.module,
          can_view: !!p.can_view,
          can_create: !!p.can_create,
          can_edit: !!p.can_edit,
          can_delete: !!p.can_delete,
        })
        .onConflict(['user_id', 'module'])
        .merge({
          can_view: !!p.can_view,
          can_create: !!p.can_create,
          can_edit: !!p.can_edit,
          can_delete: !!p.can_delete,
        });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    const payload = {
      name: d.name,
      mobile: d.mobile,
      email: d.email || '',
      role: d.role || 'Staff',
      branch_id: d.branch_id || null,
      is_active: d.is_active ?? true,
    };
    if (d.password) {
      const hash = bcrypt.hashSync(d.password, 10);
      payload.password = hash;
    }
    await db('users').where({ id: req.params.id }).update(payload);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// DELETE /api/users/:id  (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await db('users').where({ id: req.params.id }).update({ is_active: false });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;

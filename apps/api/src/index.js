require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const auth = require('./middleware/auth');
const { initDb, closeDb, getDbPath } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_IMPORT_ENABLED = process.env.DB_IMPORT_ENABLED === 'true';
const DB_IMPORT_TOKEN = process.env.DB_IMPORT_TOKEN || '';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check — always responds, even before DB is ready
app.get('/health', (req, res) => res.json({
  status: 'ok',
  db: global._dbReady ? 'ready' : 'initializing',
  timestamp: new Date().toISOString(),
}));

// One-time DB migration endpoint (disabled unless explicitly enabled)
app.post('/admin/import-db', express.raw({ type: 'application/octet-stream', limit: '200mb' }), (req, res) => {
  if (!DB_IMPORT_ENABLED) {
    return res.status(403).json({ error: 'DB import endpoint is disabled' });
  }

  const token = req.headers['x-import-token'];
  if (!token || !DB_IMPORT_TOKEN || token !== DB_IMPORT_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized import token' });
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Request body must be SQLite binary data' });
  }

  const dbPath = getDbPath();
  const backupPath = `${dbPath}.bak-${Date.now()}`;

  try {
    closeDb();
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
    }
    fs.writeFileSync(dbPath, req.body);
    initDb();
    global._dbReady = true;
    return res.json({ success: true, dbPath, backupPath });
  } catch (err) {
    console.error('DB import failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// API key auth on all /api routes
app.use('/api', auth);

// Desktop Electron contract: POST /api with { channel, data } (same as apps/desktop/server/index.js)
const { dispatchChannel } = require('./channelDispatch');
app.post('/api', async (req, res) => {
  try {
    const { channel, data } = req.body || {};
    if (typeof channel !== 'string') {
      return res.status(400).json({ error: 'Expected JSON body { channel, data }' });
    }
    const result = await dispatchChannel(channel, data);
    res.json({ result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/invoices',      require('./routes/invoices'));
app.use('/api/products',      require('./routes/products'));
app.use('/api/vendors',       require('./routes/vendors'));
app.use('/api/purchases',     require('./routes/purchases'));
app.use('/api/customers',     require('./routes/customers'));
app.use('/api/expenses',      require('./routes/expenses'));
app.use('/api/banking',       require('./routes/banking'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/branches',      require('./routes/branches'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/paybills',      require('./routes/paybills'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api/company',       require('./routes/company'));
app.use('/api/search',        require('./routes/search'));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Startup ───────────────────────────────────────────────────────────────────
// Start HTTP server IMMEDIATELY so healthcheck always gets a 200
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on port ${PORT}`);

  // Init DB after server is up
  try {
    initDb();
    global._dbReady = true;
    console.log('Database ready.');
  } catch (err) {
    console.error('=== DATABASE INIT FAILED ===');
    console.error(err.message);
    console.error(err.stack);
    // Keep server running — routes will return 500 but /health stays green
    // This lets you see the error in Railway deploy logs
  }
});

module.exports = app;

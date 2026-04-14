const express = require('express');
const cors = require('cors');
const { initDb } = require('./database');
const handlers = require('./handlers');

const app = express();

app.use(cors({ origin: (origin, cb) => cb(null, true) }));
app.use(express.json());

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/api', async (req, res) => {
  const { channel, data } = req.body || {};
  const handler = handlers[channel];
  if (!handler) return res.status(404).json({ error: `Unknown channel: ${channel}` });

  try {
    const result = await handler(data || {});
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDb();
app.listen(3001, '127.0.0.1', () => console.log('[server] Ready on http://127.0.0.1:3001'));

process.stdin.resume();
process.stdin.on('end', () => process.exit(0));

const parentPid = process.ppid;
setInterval(() => {
  try {
    process.kill(parentPid, 0);
  } catch {
    process.exit(0);
  }
}, 5000);

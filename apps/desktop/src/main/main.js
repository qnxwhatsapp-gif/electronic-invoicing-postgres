const { app, BrowserWindow } = require('electron');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';
const REMOTE_API_BASE_URL = process.env.ELECTRON_API_BASE_URL || '';
const USE_REMOTE_API = Boolean(REMOTE_API_BASE_URL);

let mainWindow;
let serverProcess;

function maybeRunLocalRichSeed() {
  if (USE_REMOTE_API || !isDev) return;
  if (process.env.AUTO_RICH_SEED === 'false') return;

  const markerPath = path.join(app.getPath('userData'), '.rich-seed.done');
  if (fs.existsSync(markerPath)) return;

  const seedPath = path.join(__dirname, 'seed.js');
  const result = spawnSync('node', [seedPath], { stdio: 'inherit' });
  if (result.status === 0) {
    fs.writeFileSync(markerPath, new Date().toISOString(), 'utf8');
    console.log('[main] Rich seed completed (first local run).');
  } else {
    console.warn('[main] Rich seed failed with code:', result.status);
  }
}

function startServer() {
  const serverPath = isDev
    ? path.join(__dirname, '../../server/index.js')
    : path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js');

  serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', isDev ? 'inherit' : 'ignore', isDev ? 'inherit' : 'ignore'],
    detached: false,
  });

  serverProcess.on('error', (err) => {
    console.error('[main] Failed to start server:', err.message);
  });
}

async function waitForServer(maxMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://127.0.0.1:3001/health');
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('[main] Express server did not start within 10 seconds');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: true,
    show: false,
    titleBarStyle: 'default',
  });

  const startURL = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../build/index.html')}`;

  mainWindow.loadURL(startURL);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  require('./electronHandlers')();
  if (!USE_REMOTE_API) {
    startServer();
    await waitForServer();
    maybeRunLocalRichSeed();
  } else {
    console.log('[main] Using remote API:', REMOTE_API_BASE_URL);
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

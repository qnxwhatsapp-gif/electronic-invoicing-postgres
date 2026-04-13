const { contextBridge, ipcRenderer } = require('electron');

const REMOTE_API_BASE_URL = process.env.ELECTRON_API_BASE_URL || '';
const REMOTE_API_KEY = process.env.ELECTRON_API_KEY || '';
const LOCAL_API_BASE_URL = 'http://127.0.0.1:3001/api';

const ELECTRON_CHANNELS = new Set([
  'settings:chooseLogoFile',
  'settings:chooseRestoreFile',
  'settings:uploadLogo',
  'settings:restoreBackup',
  'products:chooseImportFile',
  'products:chooseSaveFile',
]);

contextBridge.exposeInMainWorld('electron', {
  invoke: async (channel, data) => {
    if (ELECTRON_CHANNELS.has(channel)) {
      return ipcRenderer.invoke(channel, data);
    }

    const apiUrl = REMOTE_API_BASE_URL || LOCAL_API_BASE_URL;
    const headers = { 'Content-Type': 'application/json' };
    if (REMOTE_API_KEY) headers['x-api-key'] = REMOTE_API_KEY;

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel, data: data || {} }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.result;
  },
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

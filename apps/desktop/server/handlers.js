const Module = require('module');

const ELECTRON_ONLY_CHANNELS = new Set([
  'settings:chooseLogoFile',
  'settings:chooseRestoreFile',
  'settings:uploadLogo',
  'settings:restoreBackup',
  'products:chooseImportFile',
  'products:chooseSaveFile',
]);

let handlerMap;

function buildHandlers() {
  if (handlerMap) return handlerMap;

  const captured = {};
  const fakeIpcMain = {
    handle: (channel, fn) => {
      captured[channel] = fn;
    },
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return { ipcMain: fakeIpcMain };
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    const registerHandlers = require('../src/main/ipcHandlers');
    const { getDb } = require('./database');
    registerHandlers({ getDb });
  } finally {
    Module._load = originalLoad;
  }

  handlerMap = {};
  for (const [channel, fn] of Object.entries(captured)) {
    if (!ELECTRON_ONLY_CHANNELS.has(channel)) {
      handlerMap[channel] = async (data) => fn(null, data || {});
    }
  }

  return handlerMap;
}

module.exports = buildHandlers();

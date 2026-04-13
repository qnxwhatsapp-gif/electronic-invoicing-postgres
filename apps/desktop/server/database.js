const Module = require('module');
const os = require('os');
const path = require('path');

const DB_PATH = path.join(
  os.homedir(),
  'AppData',
  'Roaming',
  'electronic-invoicing-app',
  'invoicing.db'
);

let databaseModule;

function loadDesktopDatabaseWithMockedElectron() {
  if (databaseModule) return databaseModule;

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: {
          getPath: (name) => {
            if (name !== 'userData') return '';
            return path.dirname(DB_PATH);
          },
        },
      };
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    databaseModule = require('../src/main/database');
  } finally {
    Module._load = originalLoad;
  }

  return databaseModule;
}

function initDb() {
  const dbModule = loadDesktopDatabaseWithMockedElectron();
  return dbModule.initialize();
}

function getDb() {
  const dbModule = loadDesktopDatabaseWithMockedElectron();
  return dbModule.getDb();
}

module.exports = { initDb, getDb };

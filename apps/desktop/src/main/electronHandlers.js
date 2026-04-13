const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');

module.exports = function registerElectronHandlers() {
  ipcMain.handle('settings:chooseLogoFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('settings:chooseRestoreFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'SQLite DB', extensions: ['db', 'sqlite'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('settings:uploadLogo', async (_, { filePath }) => {
    const dest = path.join(app.getPath('userData'), `company_logo${path.extname(filePath)}`);
    fs.copyFileSync(filePath, dest);
    return { success: true, logo_path: dest };
  });

  ipcMain.handle('settings:restoreBackup', async (_, { filePath }) => {
    const dest = path.join(app.getPath('userData'), 'invoicing.db');
    fs.copyFileSync(filePath, dest);
    return { success: true };
  });

  ipcMain.handle('products:chooseImportFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV/Excel', extensions: ['csv', 'xlsx', 'xls'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('products:chooseSaveFile', async () => {
    const result = await dialog.showSaveDialog({
      defaultPath: 'products.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled) return null;
    return result.filePath;
  });
};

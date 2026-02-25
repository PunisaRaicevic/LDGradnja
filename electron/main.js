const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the built React app
  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Open file with system default application (AutoCAD for .dwg)
ipcMain.handle('open-file-with-system', async (_event, buffer, fileName) => {
  try {
    const tempDir = path.join(os.tmpdir(), 'ldgradnja');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // shell.openPath opens the file with the system's default application
    const error = await shell.openPath(filePath);
    if (error) {
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Save file to Downloads folder
ipcMain.handle('save-file-to-downloads', async (_event, buffer, fileName) => {
  try {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const filePath = path.join(downloadsPath, fileName);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
const activeWatchers = new Map(); // fileName -> FSWatcher

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

// IPC: Open file with system app AND watch for changes (AutoCAD save-back)
ipcMain.handle('open-file-with-watch', async (_event, buffer, fileName) => {
  try {
    const tempDir = path.join(os.tmpdir(), 'ldgradnja');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Stop any existing watcher for this file
    if (activeWatchers.has(fileName)) {
      activeWatchers.get(fileName).close();
      activeWatchers.delete(fileName);
    }

    // Track original file size/time to detect real changes
    let lastMtime = fs.statSync(filePath).mtimeMs;

    // Watch for changes (AutoCAD saving)
    const watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
      if (eventType === 'change') {
        try {
          const stat = fs.statSync(filePath);
          // Only fire if modification time actually changed
          if (stat.mtimeMs > lastMtime) {
            lastMtime = stat.mtimeMs;
            const newBuffer = fs.readFileSync(filePath);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('file-changed', {
                fileName,
                buffer: newBuffer.buffer.slice(newBuffer.byteOffset, newBuffer.byteOffset + newBuffer.byteLength),
              });
            }
          }
        } catch (e) {
          // File might be locked by AutoCAD during save, ignore
        }
      }
    });

    activeWatchers.set(fileName, watcher);

    // Open with system default app
    const error = await shell.openPath(filePath);
    if (error) {
      watcher.close();
      activeWatchers.delete(fileName);
      return { success: false, error };
    }
    return { success: true, watching: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Stop watching a file
ipcMain.handle('stop-watching', async (_event, fileName) => {
  if (activeWatchers.has(fileName)) {
    activeWatchers.get(fileName).close();
    activeWatchers.delete(fileName);
  }
  return { success: true };
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
  // Clean up all file watchers
  for (const [, watcher] of activeWatchers) {
    watcher.close();
  }
  activeWatchers.clear();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

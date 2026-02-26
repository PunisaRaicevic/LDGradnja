const { app, BrowserWindow, ipcMain, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

let mainWindow;
const activeWatchers = new Map(); // fileName -> FSWatcher

// Register custom protocol before app is ready
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

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

  // Handle custom app:// protocol to serve dist/ files
  // This makes absolute paths like /assets/index.js work correctly
  const distDir = path.join(__dirname, '..', 'dist');
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const filePath = path.join(distDir, pathname);
    // If file doesn't exist, serve index.html (SPA client-side routing)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return net.fetch(pathToFileURL(path.join(distDir, 'index.html')).toString());
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  mainWindow.loadURL('app://localhost/');

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
      activeWatchers.get(fileName).watcher.close();
      if (activeWatchers.get(fileName).timer) clearTimeout(activeWatchers.get(fileName).timer);
      activeWatchers.delete(fileName);
    }

    // Watch the DIRECTORY for changes (handles Excel's delete+rename save pattern)
    let debounceTimer = null;
    const watchDir = path.dirname(filePath);
    const baseFileName = path.basename(filePath);

    const watcher = fs.watch(watchDir, { persistent: false }, (eventType, changedFile) => {
      if (changedFile !== baseFileName) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          if (!fs.existsSync(filePath)) return;
          // Just notify renderer that file changed — renderer will request content
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('file-changed', { fileName });
          }
        } catch (e) {
          // ignore
        }
      }, 1500);
    });

    activeWatchers.set(fileName, { watcher, get timer() { return debounceTimer; } });

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
    const entry = activeWatchers.get(fileName);
    entry.watcher.close();
    if (entry.timer) clearTimeout(entry.timer);
    activeWatchers.delete(fileName);
  }
  return { success: true };
});

// IPC: Read temp file content (for sync back to cloud)
ipcMain.handle('read-temp-file', async (_event, fileName) => {
  try {
    const filePath = path.join(os.tmpdir(), 'ldgradnja', fileName);
    if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };
    const content = fs.readFileSync(filePath);
    return { success: true, buffer: content };
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
  // Clean up all file watchers
  for (const [, entry] of activeWatchers) {
    entry.watcher.close();
    if (entry.timer) clearTimeout(entry.timer);
  }
  activeWatchers.clear();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

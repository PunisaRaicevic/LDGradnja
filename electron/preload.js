const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Open file with system default app (e.g. AutoCAD for .dwg)
  openFileWithSystem: (buffer, fileName) => {
    return ipcRenderer.invoke('open-file-with-system', buffer, fileName);
  },

  // Open file with system app AND watch for changes (save-back to cloud)
  openFileWithWatch: (buffer, fileName) => {
    return ipcRenderer.invoke('open-file-with-watch', buffer, fileName);
  },

  // Listen for file change events (when user saves in AutoCAD)
  onFileChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('file-changed', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('file-changed', handler);
  },

  // Stop watching a file
  stopWatching: (fileName) => {
    return ipcRenderer.invoke('stop-watching', fileName);
  },

  // Save file to Downloads folder
  saveFileToDownloads: (buffer, fileName) => {
    return ipcRenderer.invoke('save-file-to-downloads', buffer, fileName);
  },
});

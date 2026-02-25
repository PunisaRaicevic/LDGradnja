const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Open file with system default app (e.g. AutoCAD for .dwg)
  openFileWithSystem: (buffer, fileName) => {
    return ipcRenderer.invoke('open-file-with-system', buffer, fileName);
  },

  // Save file to Downloads folder
  saveFileToDownloads: (buffer, fileName) => {
    return ipcRenderer.invoke('save-file-to-downloads', buffer, fileName);
  },
});

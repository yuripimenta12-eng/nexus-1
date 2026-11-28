const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
  onSources: (cb) => ipcRenderer.on('picker:sources', (_e, list) => cb(list)),
  semSom: process.platform === 'darwin', // som do computador só no Windows
  choose: (id, audio) => ipcRenderer.send('picker:choose', id ? { id, audio } : null),
});

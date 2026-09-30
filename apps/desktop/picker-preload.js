const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('picker', {
  onSources: (cb) => ipcRenderer.on('picker:sources', (_e, list) => cb(list)),
  choose: (id, audio) => ipcRenderer.send('picker:choose', id ? { id, audio } : null),
});

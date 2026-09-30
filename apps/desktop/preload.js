// Ponte mínima entre o site e o app: trazer a janela de volta e piscar na barra de tarefas
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusDesktop', {
  isDesktop: true,
  show: () => ipcRenderer.send('app:show'),
  flash: () => ipcRenderer.send('app:flash'),
});

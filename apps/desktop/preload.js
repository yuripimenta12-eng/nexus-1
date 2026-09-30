// Ponte mínima entre o site e o app: trazer a janela de volta e piscar na barra de tarefas
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusDesktop', {
  isDesktop: true,
  show: () => ipcRenderer.send('app:show'),
  flash: () => ipcRenderer.send('app:flash'),
  // Música: abre a janela de música; a próxima captura de tela pega só o som dela
  musicArm: () => ipcRenderer.invoke('music:arm'),
});

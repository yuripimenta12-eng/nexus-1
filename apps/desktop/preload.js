// Ponte mínima entre o site e o app: trazer a janela de volta e piscar na barra de tarefas
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusDesktop', {
  isDesktop: true,
  show: () => ipcRenderer.send('app:show'),
  flash: () => ipcRenderer.send('app:flash'),
  // Música: abre a janela de música; a próxima captura de tela pega só o som dela
  musicArm: () => ipcRenderer.invoke('music:arm'),
  // Atalhos da chamada com o jogo na frente: registra (ou libera com null) e avisa ao apertar
  setHotkeys: (map) => ipcRenderer.invoke('hotkeys:set', map),
  onHotkey: (cb) => {
    const handler = (_e, action) => { if (action === 'mute' || action === 'deafen') cb(action); };
    ipcRenderer.on('hotkey', handler);
    return () => ipcRenderer.removeListener('hotkey', handler);
  },
  // "Jogando …": jogo aberto agora (ou null) e aviso quando mudar
  getGame: () => ipcRenderer.invoke('activity:get'),
  onGame: (cb) => {
    const handler = (_e, name) => cb(typeof name === 'string' ? name : null);
    ipcRenderer.on('activity:game', handler);
    return () => ipcRenderer.removeListener('activity:game', handler);
  },
});

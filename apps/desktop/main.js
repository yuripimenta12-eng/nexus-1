// Nexus Link para Windows: uma janela própria para www.nexuslink.art, com
// bandeja, notificações do Windows, seletor de compartilhamento de tela e
// opção de abrir junto com o Windows. O conteúdo vem do site, então toda
// atualização publicada aparece no app sem reinstalar.
const {
  app, BrowserWindow, Tray, Menu, shell, session, desktopCapturer,
  ipcMain, nativeImage, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://www.nexuslink.art';
const START_URL = `${APP_URL}/app`;
const ALLOWED_HOSTS = new Set(['www.nexuslink.art', 'nexuslink.art']);
const VERSION = app.getVersion();

// Um único Nexus aberto: abrir de novo só traz a janela existente para frente
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

app.setAppUserModelId('art.nexuslink.desktop'); // notificações do Windows com nome/ícone certos
// Identifica o app para o site (notificações ligadas por padrão, textos próprios)
app.userAgentFallback = `${app.userAgentFallback} NexusDesktop/${VERSION}`;
// Chamadas: áudio toca sem exigir clique, e nada é "congelado" com a janela escondida
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let tray = null;
let quitting = false;

// ── Tamanho/posição da janela lembrados entre aberturas ──────────
const stateFile = () => path.join(app.getPath('userData'), 'janela.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return { width: 1280, height: 800 }; }
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch { /* não é crítico */ }
}

const isAllowed = (url) => {
  try { return ALLOWED_HOSTS.has(new URL(url).hostname); } catch { return false; }
};

function iconPath(name) {
  return path.join(__dirname, 'assets', name);
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.flashFrame(false);
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width || 1280, height: st.height || 800,
    minWidth: 900, minHeight: 600,
    title: 'Nexus Link',
    icon: iconPath('icon.png'),
    backgroundColor: '#0a0713',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // chamada e mensagens seguem com a janela minimizada/na bandeja
      spellcheck: true,
    },
  });
  if (st.maximized) win.maximize();
  Menu.setApplicationMenu(null);

  const startHidden = process.argv.includes('--oculto');
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });

  win.loadURL(START_URL);

  // Sem internet / site fora do ar: tela própria com "Tentar de novo"
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = navegação cancelada (normal)
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { volta: url || START_URL } });
  });

  // Links para fora do Nexus abrem no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowed(url)) { win.loadURL(url); return { action: 'deny' }; }
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file:') || isAllowed(url)) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  // Notificações da página: clicar traz a janela de volta (mesmo se estiver na bandeja)
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`(() => {
      const N = window.Notification;
      if (!N || N.__nexus || !window.nexusDesktop) return;
      function W(title, opts) {
        const n = new N(title, opts);
        window.nexusDesktop.flash();
        n.addEventListener('click', () => window.nexusDesktop.show());
        return n;
      }
      W.prototype = N.prototype;
      Object.defineProperty(W, 'permission', { get: () => N.permission });
      W.requestPermission = (...a) => N.requestPermission(...a);
      W.__nexus = true;
      window.Notification = W;
    })();`).catch(() => {});
  });

  // Atalhos: F5/Ctrl+R recarrega, Ctrl +/-/0 zoom
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;
    if (input.key === 'F5' || (ctrl && input.key.toLowerCase() === 'r')) { win.webContents.reload(); e.preventDefault(); }
    else if (ctrl && (input.key === '=' || input.key === '+')) { win.webContents.setZoomLevel(win.webContents.getZoomLevel() + 0.5); e.preventDefault(); }
    else if (ctrl && input.key === '-') { win.webContents.setZoomLevel(win.webContents.getZoomLevel() - 0.5); e.preventDefault(); }
    else if (ctrl && input.key === '0') { win.webContents.setZoomLevel(0); e.preventDefault(); }
  });

  win.on('focus', () => win.flashFrame(false));
  win.on('resize', saveState);
  win.on('move', saveState);

  // Fechar a janela = esconder na bandeja (como o Discord). Sair de vez pelo menu da bandeja.
  win.on('close', (e) => {
    saveState();
    if (!quitting) {
      e.preventDefault();
      win.hide();
      avisarBandejaUmaVez();
    }
  });
}

// Na primeira vez que a janela vai para a bandeja, explica onde o Nexus foi parar
function avisarBandejaUmaVez() {
  const flag = path.join(app.getPath('userData'), 'bandeja-avisada');
  if (fs.existsSync(flag) || !tray) return;
  try { fs.writeFileSync(flag, '1'); } catch { /* ok */ }
  tray.displayBalloon({
    iconType: 'info',
    title: 'O Nexus continua aberto',
    content: 'Ele fica aqui na bandeja para você receber mensagens. Para sair, clique com o botão direito no ícone → Sair.',
  });
}

function abrirComWindows() {
  return app.getLoginItemSettings({ args: ['--oculto'] }).openAtLogin;
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Abrir o Nexus', click: showWindow },
    { type: 'separator' },
    {
      label: 'Abrir junto com o Windows',
      type: 'checkbox',
      checked: abrirComWindows(),
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--oculto'] });
      },
    },
    { label: 'Recarregar', click: () => { showWindow(); win.loadURL(START_URL); } },
    { type: 'separator' },
    { label: `Nexus Link ${VERSION}`, enabled: false },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } },
  ]);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath('tray.png')));
  tray.setToolTip('Nexus Link');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', showWindow);
  tray.on('double-click', showWindow);
}

// ── Permissões: microfone, câmera, notificações, tela — só para o Nexus ──
function setupPermissions() {
  const ses = session.defaultSession;
  const allowed = new Set(['media', 'notifications', 'display-capture', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'speaker-selection']);
  ses.setPermissionRequestHandler((wc, permission, cb, details) => {
    cb(isAllowed(details.requestingUrl || wc.getURL()) && allowed.has(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => isAllowed(origin) && allowed.has(permission));

  // Compartilhar tela: abre o seletor do Nexus (telas e janelas, com prévia).
  // Exceção: "música" armada pelo site → captura só a janela de música do app.
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    if (musicArmedUntil > Date.now() && musicWin && !musicWin.isDestroyed()) {
      musicArmedUntil = 0;
      const frame = musicWin.webContents.mainFrame;
      return callback({ video: frame, audio: frame });
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });
      const choice = await openPicker(sources);
      if (!choice) return callback({});
      const source = sources.find(s => s.id === choice.id);
      if (!source) return callback({});
      callback(choice.audio ? { video: source, audio: 'loopback' } : { video: source });
    } catch {
      callback({});
    }
  });
}

function openPicker(sources) {
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      parent: win, modal: true, width: 760, height: 560, resizable: false,
      title: 'Compartilhar tela', backgroundColor: '#120d1c', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'picker-preload.js'), contextIsolation: true, sandbox: true },
    });
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); if (!picker.isDestroyed()) picker.close(); };
    const onChoose = (_e, v) => finish(v);
    ipcMain.once('picker:choose', onChoose);
    picker.on('closed', () => { ipcMain.removeListener('picker:choose', onChoose); finish(null); });
    picker.loadFile(path.join(__dirname, 'picker.html'));
    picker.webContents.once('did-finish-load', () => {
      picker.webContents.send('picker:sources', sources.map(s => ({
        id: s.id,
        name: s.name,
        screen: s.id.startsWith('screen:'),
        thumb: s.thumbnail.toDataURL(),
        icon: s.appIcon ? s.appIcon.toDataURL() : null,
      })));
    });
  });
}

// ── Janela de música (YouTube etc.) ─────────────────────────────
// O que tocar nela vai para a call como "música de aba": o Electron captura
// o áudio SÓ desta janela, então as vozes da conversa não voltam (sem eco).
let musicWin = null;
let musicArmedUntil = 0;

function openMusicWindow() {
  if (musicWin && !musicWin.isDestroyed()) {
    if (musicWin.isMinimized()) musicWin.restore();
    musicWin.show();
    return musicWin;
  }
  musicWin = new BrowserWindow({
    width: 1100, height: 720, minWidth: 480, minHeight: 360,
    title: 'Nexus — Música (o som desta janela vai para a call)',
    icon: iconPath('icon.png'),
    backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:musica', // sessão própria: cookies do YouTube ficam separados do Nexus
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false, // continua tocando minimizada
    },
  });
  // User agent de Chrome comum: sem "Electron", o YouTube trata como navegador normal
  musicWin.webContents.setUserAgent(
    app.userAgentFallback.replace(/\s*Electron\/\S+/, '').replace(/\s*NexusDesktop\/\S+/, '').replace(/\s*nexus-desktop\/\S+/, ''),
  );
  musicWin.webContents.session.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'fullscreen'));
  // Links que abririam nova janela abrem nesta mesma
  musicWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) musicWin.loadURL(url);
    return { action: 'deny' };
  });
  musicWin.on('page-title-updated', (e, title) => {
    e.preventDefault();
    musicWin.setTitle(`🎵 ${title} — tocando na call do Nexus`);
  });
  musicWin.on('closed', () => { musicWin = null; });
  musicWin.loadURL('https://www.youtube.com');
  return musicWin;
}

// O site pede "música": abre/mostra a janela e marca que a PRÓXIMA captura é dela
ipcMain.handle('music:arm', () => {
  openMusicWindow();
  musicArmedUntil = Date.now() + 15000;
  return true;
});

ipcMain.on('app:show', showWindow);
ipcMain.on('app:flash', () => { if (win && !win.isFocused()) win.flashFrame(true); });

app.on('second-instance', showWindow);
app.on('before-quit', () => { quitting = true; saveState(); });

app.whenReady().then(() => {
  setupPermissions();
  createWindow();
  createTray();
});

app.on('window-all-closed', () => { /* continua na bandeja */ });

process.on('uncaughtException', (err) => {
  dialog.showErrorBox('Nexus Link', `Ocorreu um erro inesperado:\n${err && err.message}`);
});

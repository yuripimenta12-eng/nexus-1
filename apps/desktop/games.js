// "Jogando …": descobre se algum jogo conhecido está aberto no Windows.
// Só olha os NOMES dos programas em execução (tasklist) e compara com a lista
// abaixo; nada além do nome do jogo sai do computador.
const { execFile } = require('child_process');

// executável (minúsculo) → nome exibido
const KNOWN_GAMES = {
  'league of legends.exe': 'League of Legends',
  'valorant-win64-shipping.exe': 'VALORANT',
  'cs2.exe': 'Counter-Strike 2',
  'fortniteclient-win64-shipping.exe': 'Fortnite',
  'minecraft.windows.exe': 'Minecraft',
  'gta5.exe': 'Grand Theft Auto V',
  'gta5_enhanced.exe': 'Grand Theft Auto V',
  'robloxplayerbeta.exe': 'Roblox',
  'dota2.exe': 'Dota 2',
  'rocketleague.exe': 'Rocket League',
  'r5apex.exe': 'Apex Legends',
  'r5apex_dx12.exe': 'Apex Legends',
  'overwatch.exe': 'Overwatch 2',
  'rainbowsix.exe': 'Rainbow Six Siege',
  'rainbowsix_vulkan.exe': 'Rainbow Six Siege',
  'tslgame.exe': 'PUBG: Battlegrounds',
  'fc24.exe': 'EA SPORTS FC 24',
  'fc25.exe': 'EA SPORTS FC 25',
  'fc26.exe': 'EA SPORTS FC 26',
  'cod.exe': 'Call of Duty',
  'genshinimpact.exe': 'Genshin Impact',
  'among us.exe': 'Among Us',
  'fallguys_client_game.exe': 'Fall Guys',
  'rustclient.exe': 'Rust',
  'deadbydaylight-win64-shipping.exe': 'Dead by Daylight',
  'terraria.exe': 'Terraria',
  'stardew valley.exe': 'Stardew Valley',
  'eldenring.exe': 'ELDEN RING',
  'cyberpunk2077.exe': 'Cyberpunk 2077',
  'rdr2.exe': 'Red Dead Redemption 2',
  'ts4_x64.exe': 'The Sims 4',
  'palworld-win64-shipping.exe': 'Palworld',
  'marvel-win64-shipping.exe': 'Marvel Rivals',
  'helldivers2.exe': 'HELLDIVERS 2',
  'lethal company.exe': 'Lethal Company',
  'brawlhalla.exe': 'Brawlhalla',
  'hollow_knight.exe': 'Hollow Knight',
  'destiny2.exe': 'Destiny 2',
  'warframe.x64.exe': 'Warframe',
  'pathofexile_x64steam.exe': 'Path of Exile',
  'pathofexile2.exe': 'Path of Exile 2',
  'wow.exe': 'World of Warcraft',
  'hearthstone.exe': 'Hearthstone',
  'diablo iv.exe': 'Diablo IV',
  'thefinals.exe': 'THE FINALS',
  'deltaforce-win64-shipping.exe': 'Delta Force',
  'eafc.exe': 'EA SPORTS FC',
  'forzahorizon5.exe': 'Forza Horizon 5',
  'sotgame.exe': 'Sea of Thieves',
  'phasmophobia.exe': 'Phasmophobia',
  'repo.exe': 'R.E.P.O.',
  'peak.exe': 'PEAK',
  'schedule i.exe': 'Schedule I',
};

function listProcesses() {
  return new Promise((resolve) => {
    // Sem shell: só o executável do Windows com argumentos fixos
    execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, timeout: 8000, maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
      if (err || !out) return resolve([]);
      const names = [];
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^"([^"]+)"/);
        if (m) names.push(m[1].toLowerCase());
      }
      resolve(names);
    });
  });
}

async function detectGame() {
  const running = await listProcesses();
  for (const exe of running) {
    if (KNOWN_GAMES[exe]) return KNOWN_GAMES[exe];
  }
  return null;
}

// Verifica de tempos em tempos e chama onChange só quando muda
function startGameWatcher(onChange, isEnabled, everyMs = 20000) {
  let current = null;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    const game = isEnabled() ? await detectGame().catch(() => null) : null;
    if (game !== current) { current = game; onChange(current); }
  };
  tick();
  const t = setInterval(tick, everyMs);
  return {
    current: () => current,
    refresh: tick,
    stop: () => { stopped = true; clearInterval(t); },
  };
}

module.exports = { startGameWatcher, KNOWN_GAMES };

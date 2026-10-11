// Gera as cartas do UNidos a partir das artes do usuário (pasta unidos-artes):
// números 0–9 de cada cor (troca o número do molde) e especiais coloridas.
// Uso (na pasta apps/web): node scripts/gerar-cartas-unidos.js public/unidos/cartas
// (usa o sharp do backend: SHARP=../server/node_modules/sharp)
const sharp = require(process.env.SHARP || 'sharp');
const fs = require('fs');
const path = require('path');

// Pasta com as artes originais (padrão: unidos-artes na raiz do projeto)
const DIR = (process.env.UNIDOS_ARTES || path.join(__dirname, '../../../unidos-artes')) + '/';
const arte = (n) => DIR + `Imagem do ChatGPT 11 de out. de 2026, ${n}.png`;
const OUT = process.argv[2];
const TESTE = process.argv[3] === 'teste';
fs.mkdirSync(OUT, { recursive: true });

// Molde de número de cada cor + estilo do número desenhado
const CORES = {
  roxo: { cantos: { tl: [130, 180, 230, 280, 165], br: [805, 1225, 905, 1358, 175] }, cantoContorno: '#6a2fb0', molde: '17_22_26-1', fundoCentro: ['#2a0f40', '#0d0614'], fundoCanto: '#0e0a10', fundoCantoBaixo: '#0b080d',
    centro: ['#f6e6ff', '#c79bff', '#8a3dff'], canto: '#f0dcff', brilho: '#b46cff', contorno: '#4a1d7a' },
  laranja: { cantos: { tl: [120, 175, 220, 304, 178], br: [805, 1190, 915, 1320, 178] }, cantoContorno: '#ff7a1a', molde: '17_22_35-2', fundoCentro: ['#3a1806', '#0f0705'], fundoCanto: '#100c0d', fundoCantoBaixo: '#0d0c0e',
    centro: ['#ffe0a0', '#ffa733', '#ff6a00'], canto: '#fff4ea', brilho: '#ff8a1f', contorno: '#6b2a00' },
  prata: { cantos: { tl: [125, 155, 245, 282, 172], br: [775, 1205, 895, 1370, 185] }, cantoContorno: '#2a2a2e', molde: '17_22_40-4', fundoCentro: ['#1c1d1f', '#0a0a0b'], fundoCanto: '#0a0a0a', fundoCantoBaixo: '#0c0c0c',
    centro: ['#ffffff', '#d4d4da', '#8b8b93'], canto: '#ececf0', brilho: '#ffffff', contorno: '#3a3a40' },
  dourado: { cantos: { tl: [125, 145, 242, 290, 190], br: [785, 1240, 907, 1410, 200] }, cantoContorno: '#4a4030', molde: '17_22_38-3', fundoCentro: ['#fff3d6', '#f6e3bc'], fundoCanto: '#fceccc', fundoCantoBaixo: '#f8e7c6',
    centro: ['#2b2b2e', '#0d0d0f', '#000000'], canto: '#101012', brilho: '#ffb84a', contorno: '#c99a3a' },
};
const FONTE = "font-family=\"'Arial Black', Arial\" font-weight=\"900\"";

function svgNumero(c, d) {
  const g = `<linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="${c.centro[0]}"/><stop offset="0.55" stop-color="${c.centro[1]}"/><stop offset="1" stop-color="${c.centro[2]}"/></linearGradient>`;
  const fundo = `<radialGradient id="f" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c.fundoCentro[0]}"/><stop offset="0.85" stop-color="${c.fundoCentro[1]}"/><stop offset="1" stop-color="${c.fundoCentro[1]}"/></radialGradient>`;
  const hex = `<pattern id="h" width="44" height="76" patternUnits="userSpaceOnUse"><path d="M22 0 L44 12.7 L44 38 L22 50.7 L0 38 L0 12.7 Z M22 50.7 L22 76" fill="none" stroke="${c.brilho}" stroke-opacity="0.07" stroke-width="2"/></pattern>`;
  const glow = `<filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
  <defs>${g}${fundo}${hex}${glow}</defs>
  <!-- apaga o número antigo: o miolo é um disco (fica dentro do anel) -->
  <circle cx="514" cy="764" r="290" fill="url(#f)"/><circle cx="514" cy="764" r="252" fill="url(#h)"/>
  <circle cx="514" cy="764" r="254" fill="none" stroke="${c.brilho}" stroke-opacity="0.45" stroke-width="3"/>
  <!-- apaga os números dos cantos -->
  <rect x="${c.cantos.tl[0] - 10}" y="${c.cantos.tl[1] - 10}" width="${c.cantos.tl[2] - c.cantos.tl[0] + 20}" height="${c.cantos.tl[3] - c.cantos.tl[1] + 34}" rx="12" fill="${c.fundoCanto}"/>
  <rect x="${c.cantos.br[0] - 10}" y="${c.cantos.br[1] - 10}" width="${c.cantos.br[2] - c.cantos.br[0] + 20}" height="${c.cantos.br[3] - c.cantos.br[1] + 30}" rx="12" fill="${c.fundoCantoBaixo}"/>
  <!-- número novo -->
  <text x="514" y="934" text-anchor="middle" font-size="470" ${FONTE} fill="${c.brilho}" opacity="0.5" filter="url(#b)">${d}</text>
  <text x="514" y="934" text-anchor="middle" font-size="470" ${FONTE} fill="url(#g)" stroke="${c.contorno}" stroke-width="7">${d}</text>
  <text x="${(c.cantos.tl[0] + c.cantos.tl[2]) / 2}" y="${c.cantos.tl[3]}" text-anchor="middle" font-size="${c.cantos.tl[4]}" ${FONTE} fill="${c.canto}" stroke="${c.cantoContorno}" stroke-width="5">${d}</text>
  <text x="${(c.cantos.br[0] + c.cantos.br[2]) / 2}" y="${c.cantos.br[3]}" text-anchor="middle" font-size="${c.cantos.br[4]}" ${FONTE} fill="${c.canto}" stroke="${c.cantoContorno}" stroke-width="5">${d}</text>
</svg>`);
}

// Especiais coloridas: a arte do usuário + moldura e selo na cor
const ESPECIAIS = { bloqueio: '17_22_50-10', troca: '17_22_44-7', mais2: '17_22_46-8', call: '17_22_43-6' };
const COR_MOLDURA = { roxo: '#9b4dff', laranja: '#ff7a1a', prata: '#d9d9e0', dourado: '#f2c35b' };
function svgMoldura(cor) {
  const c = COR_MOLDURA[cor];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536">
  <defs><filter id="b"><feGaussianBlur stdDeviation="10"/></filter></defs>
  <rect x="78" y="118" width="868" height="1300" rx="62" fill="none" stroke="${c}" stroke-width="22" opacity="0.55" filter="url(#b)"/>
  <rect x="80" y="120" width="864" height="1296" rx="60" fill="none" stroke="${c}" stroke-width="14"/>
  <circle cx="512" cy="1355" r="34" fill="${c}" stroke="#0a0713" stroke-width="6"/>
</svg>`);
}

(async () => {
  const lista = [];
  const cores = TESTE ? Object.keys(CORES) : Object.keys(CORES);
  for (const cor of cores) {
    const c = CORES[cor];
    const digitos = TESTE ? [7] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (const d of digitos) {
      const nome = `${cor}-${d}.webp`;
      const original = { roxo: 3, laranja: 0, dourado: 6, prata: 9 }[cor] === d;
      await sharp(original ? arte(c.molde) : await sharp(arte(c.molde)).composite([{ input: svgNumero(c, d) }]).png().toBuffer()).trim({ threshold: 10 })
        .resize(512, 768, { fit: 'fill' }).webp({ quality: 84, effort: 5 }).toFile(path.join(OUT, nome));
      lista.push(nome);
    }
    for (const [tipo, n] of Object.entries(ESPECIAIS)) {
      if (TESTE && tipo !== 'call') continue;
      const nome = `${cor}-${tipo}.webp`;
      await sharp(await sharp(arte(n)).composite([{ input: svgMoldura(cor) }]).png().toBuffer()).trim({ threshold: 10 })
        .resize(512, 768, { fit: 'fill' }).webp({ quality: 84, effort: 5 }).toFile(path.join(OUT, nome));
      lista.push(nome);
    }
  }
  if (!TESTE) {
    for (const [nome, n] of [['conexao.webp', '17_22_41-5'], ['todos-unidos.webp', '17_22_47-9'], ['verso.webp', '17_22_52-11']]) {
      await sharp(arte(n)).trim({ threshold: 10 }).resize(512, 768, { fit: 'fill' }).webp({ quality: 84, effort: 5 }).toFile(path.join(OUT, nome));
      lista.push(nome);
    }
    await sharp(arte('17_22_02')).trim({ threshold: 10 }).resize(900).webp({ quality: 84, effort: 5 }).toFile(path.join(OUT, 'logo.webp'));
    lista.push('logo.webp');
  }
  console.log(lista.length, 'arquivos:', lista.join(', '));
})().catch(e => { console.error(e); process.exit(1); });

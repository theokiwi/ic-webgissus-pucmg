// Gera public/og.png e os ícones do PWA a partir de SVG, rasterizando com o Chromium (Playwright).
// Uso: CHROMIUM=/caminho/do/chromium node apps/web/scripts/gerar-imagens.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const publico = resolve(aqui, '../public');
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const AZUL = '#1565c0';
const AZUL_ESCURO = '#0d47a1';
const VERDE = '#2e7d32';

/** Cruz de saúde dentro de um alfinete de mapa, centrada em (0,0), altura ~ 2*r. */
function emblema(r) {
  const w = r * 0.78;
  return `
  <g>
    <path d="M0 ${r} C ${-r * 0.2} ${r * 0.62} ${-w} ${r * 0.1} ${-w} ${-r * 0.32} A ${w} ${w} 0 1 1 ${w} ${-r * 0.32} C ${w} ${r * 0.1} ${r * 0.2} ${r * 0.62} 0 ${r} Z" fill="#fff"/>
    <rect x="${-r * 0.1}" y="${-r * 0.6}" width="${r * 0.2}" height="${r * 0.56}" rx="${r * 0.04}" fill="${VERDE}"/>
    <rect x="${-r * 0.28}" y="${-r * 0.42}" width="${r * 0.56}" height="${r * 0.2}" rx="${r * 0.04}" fill="${VERDE}"/>
  </g>`;
}

const fundo = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${AZUL_ESCURO}"/><stop offset="1" stop-color="${AZUL}"/></linearGradient></defs>`;

const icone = (tam, { maskable = false } = {}) => {
  // Maskable: o conteúdo fica nos 80% centrais (zona segura) e o fundo vai até a borda.
  const r = tam * (maskable ? 0.27 : 0.34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 ${tam} ${tam}">
  ${fundo('g')}
  <rect width="${tam}" height="${tam}" rx="${maskable ? 0 : tam * 0.2}" fill="url(#g)"/>
  <g transform="translate(${tam / 2} ${tam * 0.46})">${emblema(r)}</g>
</svg>`;
};

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="Inter, 'Segoe UI', Roboto, Arial, sans-serif">
  ${fundo('g')}
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1010" cy="140" r="260" fill="#fff" opacity="0.06"/>
  <circle cx="1120" cy="560" r="200" fill="#fff" opacity="0.06"/>
  <rect x="80" y="438" width="170" height="10" rx="5" fill="#a5d6a7"/>
  <text x="80" y="360" fill="#fff" font-size="100" font-weight="800">WebGIS SUS-MG</text>
  <text x="80" y="520" fill="#fff" font-size="46" font-weight="500">Saúde gratuita pelo SUS em Minas Gerais</text>
  <text x="80" y="100" fill="#bbdefb" font-size="30" font-weight="600" letter-spacing="4">MAPA DOS ESTABELECIMENTOS</text>
  <g transform="translate(1050 280) scale(1)">${emblema(150)}</g>
</svg>`;

const saidas = [
  ['og.png', og, 1200, 630],
  ['icons/icon-192.png', icone(192), 192, 192],
  ['icons/icon-512.png', icone(512), 512, 512],
  ['icons/icon-maskable-512.png', icone(512, { maskable: true }), 512, 512],
  ['icons/apple-touch-icon.png', icone(180, { maskable: true }), 180, 180],
];

mkdirSync(resolve(publico, 'icons'), { recursive: true });
writeFileSync(resolve(publico, 'icons/icon.svg'), icone(512));

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? '/run/current-system/sw/bin/chromium',
  args: ['--no-sandbox'],
});
for (const [arquivo, svg, w, h] of saidas) {
  const pagina = await navegador.newPage({ viewport: { width: w, height: h } });
  await pagina.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await pagina.screenshot({ path: resolve(publico, arquivo), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  await pagina.close();
}
await navegador.close();
console.log('imagens geradas em', publico);

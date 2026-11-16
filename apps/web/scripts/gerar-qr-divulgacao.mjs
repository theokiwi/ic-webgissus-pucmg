// Gera os QR codes dos atalhos de divulgação (ADR 0009) em SVG, prontos para imprimir.
// Uso: pnpm divulgacao:qr https://seu-dominio.vercel.app
// Saída: data/divulgacao/qr-<atalho>.svg (fora do Git, como todo data/).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

// Mesmos caminhos de ATALHOS_DIVULGACAO (packages/domain/src/divulgacao.ts).
const ATALHOS = ['cartaz', 'insta', 'whats'];

const base = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/.test(base)) {
  console.error('Informe a URL pública do site, sem caminho. Ex.: pnpm divulgacao:qr https://webgis-sus-mg.vercel.app');
  process.exit(1);
}

const saida = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data/divulgacao');
mkdirSync(saida, { recursive: true });

for (const atalho of ATALHOS) {
  const url = `${base}/${atalho}`;
  // Correção de erro "M" (15%) aguenta impressão comum e um pouco de desgaste do papel.
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#000', light: '#fff' } });
  const arquivo = resolve(saida, `qr-${atalho}.svg`);
  writeFileSync(arquivo, svg);
  console.log(`${url} → ${arquivo}`);
}

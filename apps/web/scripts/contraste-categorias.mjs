// Razão de contraste (WCAG) das cores de categoria contra branco; marcadores gráficos exigem >= 3:1.
import { readFileSync } from 'node:fs';
const { categorias } = JSON.parse(readFileSync(new URL('../../../packages/domain/categorias.json', import.meta.url)));
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (h) => { const n = parseInt(h.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
let falhas = 0;
for (const c of categorias) {
  const r = 1.05 / (lum(c.cor) + 0.05);
  const ok = r >= 3;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok   ' : 'FALHA'} ${r.toFixed(2).padStart(5)}:1  ${c.cor}  ${c.slug}`);
}
process.exit(falhas ? 1 : 0);

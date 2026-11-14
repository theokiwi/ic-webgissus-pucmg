/**
 * Escala em classes por quantis: calcula as quebras a partir dos valores
 * reais e gera a expressão `step` do MapLibre e os rótulos da legenda.
 */

/**
 * Quebras (limites inferiores das classes 2..n) por quantis. Valores repetidos
 * podem colapsar classes; o resultado é estritamente crescente.
 */
export function calcularQuebras(valores: readonly (number | null | undefined)[], nClasses = 5): number[] {
  const v = valores.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0 || nClasses < 2) return [];
  const quebras: number[] = [];
  for (let i = 1; i < nClasses; i++) {
    const pos = (i / nClasses) * (v.length - 1);
    const base = Math.floor(pos);
    const frac = pos - base;
    const q = v[base] + (v[Math.min(base + 1, v.length - 1)] - v[base]) * frac;
    quebras.push(arredondar(q));
  }
  const unicas = quebras.filter((q, i) => i === 0 || q > quebras[i - 1]);
  // Uma quebra igual ao mínimo deixaria a primeira classe vazia.
  return unicas.filter((q) => q > v[0]);
}

function arredondar(x: number): number {
  const mag = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2;
  return Number(x.toFixed(mag));
}

/** Índice da classe (0..quebras.length) em que o valor cai; -1 se não há valor. */
export function classeDe(valor: number | null | undefined, quebras: readonly number[]): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return -1;
  let i = 0;
  while (i < quebras.length && valor >= quebras[i]) i++;
  return i;
}

export const COR_SEM_DADO = '#d9d9d9';

/** Expressão MapLibre de cor: classes por `step`, cinza quando a propriedade é nula. */
export function expressaoCor(prop: string, quebras: readonly number[], cores: readonly string[]): unknown[] {
  const paleta = cores.slice(0, quebras.length + 1);
  if (quebras.length === 0) return ['case', ['==', ['get', prop], null], COR_SEM_DADO, paleta[0] ?? COR_SEM_DADO];
  const step: unknown[] = ['step', ['to-number', ['get', prop], 0], paleta[0]];
  quebras.forEach((q, i) => step.push(q, paleta[i + 1]));
  return ['case', ['==', ['get', prop], null], COR_SEM_DADO, step];
}

export interface ClasseLegenda {
  cor: string;
  rotulo: string;
}

/** Rótulos "até X", "X a Y", "Y ou mais" para a legenda. */
export function classesLegenda(
  quebras: readonly number[],
  cores: readonly string[],
  formatar: (n: number) => string,
): ClasseLegenda[] {
  if (quebras.length === 0) return [];
  const n = quebras.length + 1;
  return Array.from({ length: n }, (_, i) => {
    const rotulo =
      i === 0
        ? `menos de ${formatar(quebras[0])}`
        : i === n - 1
          ? `${formatar(quebras[i - 1])} ou mais`
          : `${formatar(quebras[i - 1])} a menos de ${formatar(quebras[i])}`;
    return { cor: cores[i], rotulo };
  });
}

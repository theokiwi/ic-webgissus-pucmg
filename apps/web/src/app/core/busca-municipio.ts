import { normalizar } from '../shared/formatadores';

/**
 * Municípios cujo nome casa com o termo, ignorando acento e caixa. Os que começam pelo
 * termo vêm antes dos que só o contêm; dentro de cada grupo, ordem alfabética.
 */
export function municipiosQueCasam<T extends { nome: string }>(lista: readonly T[], termo: string, max = 5): T[] {
  const q = normalizar(termo);
  if (!q) return [];
  const comeca: T[] = [];
  const contem: T[] = [];
  for (const m of lista) {
    const n = normalizar(m.nome);
    if (n.startsWith(q)) comeca.push(m);
    else if (n.includes(q)) contem.push(m);
  }
  const ordem = (a: T, b: T) => a.nome.localeCompare(b.nome, 'pt-BR');
  return [...comeca.sort(ordem), ...contem.sort(ordem)].slice(0, max);
}

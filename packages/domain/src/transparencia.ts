/**
 * Selo de transparência da ficha (ADR 0009): fonte, datas e alerta de cadastro antigo.
 */

/** Decisão do autor: alerta quando a unidade não atualiza o cadastro há mais de 24 meses. */
export const MESES_CADASTRO_ANTIGO = 24;

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Meses inteiros entre o mês da atualização ('AAAA-MM-DD') e a competência ('AAAAMM'); null se faltar um dos dois. */
export function mesesDesdeAtualizacao(atualizadoEm: string | null, competencia: string): number | null {
  const a = /^(\d{4})-(\d{2})-\d{2}$/.exec(atualizadoEm ?? '');
  const c = /^(\d{4})(\d{2})$/.exec(competencia);
  if (!a || !c) return null;
  return Number(c[1]) * 12 + Number(c[2]) - (Number(a[1]) * 12 + Number(a[2]));
}

/** Cadastro sem atualização há mais de `limite` meses em relação à competência exibida. Sem data, não alerta. */
export function cadastroDesatualizado(
  atualizadoEm: string | null,
  competencia: string,
  limite = MESES_CADASTRO_ANTIGO,
): boolean {
  const m = mesesDesdeAtualizacao(atualizadoEm, competencia);
  return m !== null && m > limite;
}

/** '202609' → 'set/2026'. */
export function competenciaPorExtenso(competencia: string): string {
  const c = /^(\d{4})(\d{2})$/.exec(competencia);
  const mes = c ? MESES_ABREV[Number(c[2]) - 1] : undefined;
  return c && mes ? `${mes}/${c[1]}` : competencia;
}

/** Ficha pública do estabelecimento no site do CNES. `coUnidade` = município DATASUS (6) + CNES (7). */
export function urlFichaCnes(codigoUnidade: string): string | null {
  return /^\d{13}$/.test(codigoUnidade)
    ? `https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/index.jsp?coUnidade=${codigoUnidade}`
    : null;
}

/**
 * Pesquisa de estabelecimentos por tipo de unidade (TP_UNIDADE do CNES) e por um
 * indicador do município onde a unidade fica (ADR 0010).
 */

/** Indicadores municipais: colorem o mapa e servem de critério da pesquisa. */
export type IndicadorMunicipal = 'populacao' | 'densidade' | 'por10mil' | 'total';

export const INDICADORES_MUNICIPAIS: readonly IndicadorMunicipal[] = ['populacao', 'densidade', 'por10mil', 'total'];

export function ehIndicadorMunicipal(v: unknown): v is IndicadorMunicipal {
  return (INDICADORES_MUNICIPAIS as readonly unknown[]).includes(v);
}

/** O mínimo do município para calcular qualquer indicador. */
export interface ValoresMunicipio {
  populacao: number | null;
  densidade: number | null;
  /** Total de estabelecimentos do universo no município (todas as categorias). */
  totalEstabelecimentos: number;
}

/** Valor do indicador no município; null quando não há dado (ex.: sem população). */
export function valorIndicador(m: ValoresMunicipio, ind: IndicadorMunicipal): number | null {
  switch (ind) {
    case 'populacao':
      return m.populacao;
    case 'densidade':
      return m.densidade;
    case 'total':
      return m.totalEstabelecimentos;
    case 'por10mil':
      return m.populacao ? (m.totalEstabelecimentos / m.populacao) * 10_000 : null;
  }
}

/**
 * Faixa do critério: `min` inclusivo ("a partir de") e `max` exclusivo ("menos de"),
 * a mesma leitura das classes da legenda ("X a menos de Y"). Null = sem limite.
 */
export interface Faixa {
  min: number | null;
  max: number | null;
}

export function faixaVazia(f: Faixa): boolean {
  return f.min === null && f.max === null;
}

/** Com os dois limites, o mínimo tem de ser menor que o máximo. */
export function faixaValida(f: Faixa): boolean {
  return f.min === null || f.max === null || f.min < f.max;
}

/**
 * O valor passa na faixa? Sem limites, tudo passa (inclusive município sem dado);
 * com algum limite, município sem dado fica de fora.
 */
export function dentroDaFaixa(valor: number | null, f: Faixa): boolean {
  if (faixaVazia(f)) return true;
  if (valor === null || !Number.isFinite(valor)) return false;
  return (f.min === null || valor >= f.min) && (f.max === null || valor < f.max);
}

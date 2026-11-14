import type { MunicipioResumoDTO } from '@webgissus/domain';

export type TemaId = 'populacao' | 'densidade' | 'por10mil' | 'total';

export interface Tema {
  id: TemaId;
  /** Rótulo da aba. */
  rotulo: string;
  /** Título longo, usado na legenda e na lista. */
  titulo: string;
  unidade: string;
  /** Propriedade correspondente nos tiles de municípios. */
  prop: 'populacao' | 'densidade' | 'estab_por_10mil' | 'total';
  /** Rampa sequencial, da classe mais baixa para a mais alta (5 classes). */
  cores: readonly string[];
  /** Casas decimais ao exibir valores. */
  casas: number;
}

export const TEMA_PADRAO: TemaId = 'populacao';

export const TEMAS: readonly Tema[] = [
  {
    id: 'populacao',
    rotulo: 'População',
    titulo: 'População',
    unidade: 'habitantes',
    prop: 'populacao',
    cores: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
    casas: 0,
  },
  {
    id: 'densidade',
    rotulo: 'Densidade',
    titulo: 'Densidade demográfica',
    unidade: 'hab/km²',
    prop: 'densidade',
    cores: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
    casas: 1,
  },
  {
    id: 'por10mil',
    rotulo: 'Estab. por 10 mil hab.',
    titulo: 'Estabelecimentos por 10 mil habitantes',
    unidade: 'por 10 mil hab.',
    prop: 'estab_por_10mil',
    cores: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
    casas: 1,
  },
  {
    id: 'total',
    rotulo: 'Total de estab.',
    titulo: 'Total de estabelecimentos',
    unidade: 'estabelecimentos',
    prop: 'total',
    cores: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
    casas: 0,
  },
];

export function temaPorId(id: TemaId): Tema {
  return TEMAS.find((t) => t.id === id) ?? TEMAS[0];
}

export function ehTemaId(v: unknown): v is TemaId {
  return TEMAS.some((t) => t.id === v);
}

/** Valor do município no tema; null quando não há dado (ex.: sem população). */
export function valorTema(m: MunicipioResumoDTO, tema: TemaId): number | null {
  switch (tema) {
    case 'populacao':
      return m.populacao;
    case 'densidade':
      return m.densidade;
    case 'total':
      return m.totalEstabelecimentos;
    case 'por10mil':
      return m.populacao ? (m.totalEstabelecimentos / m.populacao) * 10000 : null;
  }
}

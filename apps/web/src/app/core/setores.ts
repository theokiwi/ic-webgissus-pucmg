/**
 * Camada de setores censitários: classes fixas de densidade (hab/km²). Valem para
 * o estado inteiro (setores rurais com poucos habitantes até centros urbanos
 * densos), por isso não são quantis. Classes escolhidas pelo agente como
 * decisão de visualização; não são regra de negócio.
 */
export const QUEBRAS_DENSIDADE_SETOR: readonly number[] = [25, 250, 1000, 4000, 10000];

/** Da menor para a maior densidade (6 classes). */
export const CORES_DENSIDADE_SETOR: readonly string[] = ['#ffffd4', '#fee391', '#fec44f', '#fe9929', '#d95f0e', '#8c2d04'];

export const COR_SEM_DENSIDADE = '#e0e0e0';

export const ZOOM_MINIMO_SETORES = 9;

/** Rótulos das classes da legenda ("< 25", "25 a 250", ..., "≥ 10.000"). */
export function rotulosDensidadeSetor(fmt: (n: number) => string): string[] {
  const q = QUEBRAS_DENSIDADE_SETOR;
  return [
    `menos de ${fmt(q[0])}`,
    ...q.slice(0, -1).map((v, i) => `${fmt(v)} a ${fmt(q[i + 1])}`),
    `${fmt(q[q.length - 1])} ou mais`,
  ];
}

import dados from '../categorias.json' with { type: 'json' };

export type CategoriaSlug =
  | 'atencao_basica'
  | 'urgencia'
  | 'hospital'
  | 'laboratorio'
  | 'especialidades'
  | 'saude_mental'
  | 'farmacia'
  | 'vacinacao'
  | 'hemocentro'
  | 'promocao_saude';

export interface Categoria {
  slug: CategoriaSlug;
  rotulo: string;
  /** Cor do marcador e da legenda no mapa. */
  cor: string;
}

export const CATEGORIAS: readonly Categoria[] = dados.categorias as Categoria[];

export function categoria(slug: CategoriaSlug): Categoria {
  const c = CATEGORIAS.find((x) => x.slug === slug);
  if (!c) throw new Error(`categoria desconhecida: ${slug}`);
  return c;
}

export function rotuloCategoria(slug: CategoriaSlug): string {
  return categoria(slug).rotulo;
}

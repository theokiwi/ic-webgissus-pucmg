import dados from '@webgissus/domain/categorias.json' with { type: 'json' };
import type { CategoriaSlug } from '@webgissus/domain';

/** Slugs lidos em runtime da fonte única (packages/domain/categorias.json). */
export const SLUGS_CATEGORIA: readonly CategoriaSlug[] = dados.categorias.map(
  (c) => c.slug as CategoriaSlug,
);

export function ehCategoria(valor: string): valor is CategoriaSlug {
  return (SLUGS_CATEGORIA as readonly string[]).includes(valor);
}

import { describe, expect, it } from 'vitest';
import { CATEGORIAS, categoria, rotuloCategoria, type CategoriaSlug } from './categorias.js';

describe('categorias', () => {
  it('o JSON tem exatamente os slugs do tipo CategoriaSlug', () => {
    const esperado: CategoriaSlug[] = [
      'atencao_basica', 'urgencia', 'hospital', 'laboratorio', 'especialidades',
      'saude_mental', 'farmacia', 'vacinacao', 'hemocentro', 'promocao_saude',
    ];
    expect(CATEGORIAS.map((c) => c.slug).sort()).toEqual([...esperado].sort());
  });

  it('não tem slugs nem cores duplicados', () => {
    expect(new Set(CATEGORIAS.map((c) => c.slug)).size).toBe(CATEGORIAS.length);
    expect(new Set(CATEGORIAS.map((c) => c.cor)).size).toBe(CATEGORIAS.length);
  });

  it('toda cor é hexadecimal de 6 dígitos', () => {
    for (const c of CATEGORIAS) expect(c.cor).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('devolve rótulo e categoria', () => {
    expect(rotuloCategoria('urgencia')).toMatch(/UPA/);
    expect(categoria('vacinacao').slug).toBe('vacinacao');
  });
});

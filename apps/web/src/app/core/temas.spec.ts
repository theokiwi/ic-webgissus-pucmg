import type { MunicipioResumoDTO } from '@webgissus/domain';
import { valorTema } from './temas';

const m: MunicipioResumoDTO = {
  cd: '3106200', nome: 'Belo Horizonte', cdRegiao: '1', cdMacro: '1',
  populacao: 2_000_000, areaKm2: 331, densidade: 6042, totalEstabelecimentos: 1500, porCategoria: {},
};

describe('valorTema', () => {
  it('lê o valor de cada tema', () => {
    expect(valorTema(m, 'populacao')).toBe(2_000_000);
    expect(valorTema(m, 'densidade')).toBe(6042);
    expect(valorTema(m, 'total')).toBe(1500);
    expect(valorTema(m, 'por10mil')).toBeCloseTo(7.5);
  });
  it('sem população, estabelecimentos por 10 mil é nulo', () => {
    expect(valorTema({ ...m, populacao: null }, 'por10mil')).toBeNull();
    expect(valorTema({ ...m, populacao: 0 }, 'por10mil')).toBeNull();
  });
});

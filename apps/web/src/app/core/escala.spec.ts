import { calcularQuebras, classeDe, classesLegenda, COR_SEM_DADO, expressaoCor } from './escala';

describe('escala em classes', () => {
  it('calcula quebras por quantis, ignorando nulos', () => {
    const valores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, undefined];
    const q = calcularQuebras(valores, 5);
    expect(q).toEqual([2.8, 4.6, 6.4, 8.2]);
  });

  it('as quebras são estritamente crescentes mesmo com muitos valores repetidos', () => {
    const q = calcularQuebras([0, 0, 0, 0, 0, 0, 0, 5, 10, 20], 5);
    for (let i = 1; i < q.length; i++) expect(q[i]).toBeGreaterThan(q[i - 1]);
    expect(q.every((x) => x > 0)).toBe(true);
  });

  it('sem valores, não há quebras', () => {
    expect(calcularQuebras([], 5)).toEqual([]);
    expect(calcularQuebras([null], 5)).toEqual([]);
  });

  it('classeDe: limite inferior pertence à classe de cima', () => {
    const q = [10, 20, 30];
    expect(classeDe(5, q)).toBe(0);
    expect(classeDe(10, q)).toBe(1);
    expect(classeDe(29.9, q)).toBe(2);
    expect(classeDe(30, q)).toBe(3);
    expect(classeDe(null, q)).toBe(-1);
  });

  it('expressaoCor monta step com cinza para nulos', () => {
    const e = expressaoCor('populacao', [10, 20], ['#a', '#b', '#c']) as unknown[];
    expect(e[0]).toBe('case');
    expect(e[2]).toBe(COR_SEM_DADO);
    expect(e[3]).toEqual(['step', ['to-number', ['get', 'populacao'], 0], '#a', 10, '#b', 20, '#c']);
  });

  it('expressaoCor sem quebras usa uma cor única', () => {
    const e = expressaoCor('total', [], ['#a', '#b']) as unknown[];
    expect(e[3]).toBe('#a');
  });

  it('classesLegenda gera rótulos e cores por classe', () => {
    const l = classesLegenda([10, 20], ['#a', '#b', '#c'], (n) => String(n));
    expect(l).toEqual([
      { cor: '#a', rotulo: 'menos de 10' },
      { cor: '#b', rotulo: '10 a menos de 20' },
      { cor: '#c', rotulo: '20 ou mais' },
    ]);
  });
});

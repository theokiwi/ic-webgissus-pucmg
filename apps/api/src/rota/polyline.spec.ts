import { decodificarPolyline } from './polyline.js';

describe('decodificarPolyline', () => {
  it('decodifica precisão 6 para [lon, lat]', () => {
    // Exemplo do Google (precisão 5): (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
    const p5 = decodificarPolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
    expect(p5).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
  });

  it('usa precisão 6 por padrão', () => {
    const p = decodificarPolyline('~ys`e@~ynyrA_pR_pR');
    expect(p).toHaveLength(2);
    expect(p[0][0]).toBeCloseTo(-43.95, 6);
    expect(p[0][1]).toBeCloseTo(-19.95, 6);
    expect(p[1][0]).toBeCloseTo(-43.94, 6);
    expect(p[1][1]).toBeCloseTo(-19.94, 6);
  });

  it('string vazia dá lista vazia; truncada dá erro', () => {
    expect(decodificarPolyline('')).toEqual([]);
    expect(() => decodificarPolyline('_p~iF~ps|')).toThrow();
  });
});

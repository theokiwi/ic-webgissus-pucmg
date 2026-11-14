import { converterRespostaValhalla, montarCorpoValhalla } from './valhalla.js';

describe('montarCorpoValhalla', () => {
  const de = { lat: -19.9, lon: -43.9 };
  const para = { lat: -19.8, lon: -43.8 };

  it.each([
    ['auto', 'auto'],
    ['pedestre', 'pedestrian'],
    ['bicicleta', 'bicycle'],
  ] as const)('modo %s usa costing %s', (modo, costing) => {
    expect(montarCorpoValhalla(de, para, modo)).toEqual({
      locations: [de, para],
      costing,
      directions_options: { language: 'pt-BR', units: 'kilometers' },
    });
  });
});

describe('converterRespostaValhalla', () => {
  it('junta trechos sem repetir o ponto de emenda', () => {
    const r = converterRespostaValhalla(
      {
        trip: {
          summary: { length: 2, time: 60 },
          legs: [
            { shape: '~ys`e@~ynyrA_pR_pR', maneuvers: [{ instruction: 'a', length: 1, time: 30 }] },
            { shape: '~ys`e@~ynyrA_pR_pR', maneuvers: [{ instruction: 'b', length: 1, time: 30 }] },
          ],
        },
      },
      'auto',
    );
    expect(r.geometria.coordinates).toHaveLength(3);
    expect(r.distanciaM).toBe(2000);
    expect(r.passos).toHaveLength(2);
  });

  it('erro sem trip', () => {
    expect(() => converterRespostaValhalla({}, 'auto')).toThrow();
  });
});

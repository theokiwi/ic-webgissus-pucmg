import { converterRespostaPhoton, montarUrlPhoton } from './photon.js';

const feature = (properties: Record<string, unknown>, coordinates: [number, number]) => ({
  type: 'Feature',
  properties: { countrycode: 'BR', state: 'Minas Gerais', ...properties },
  geometry: { type: 'Point', coordinates },
});

describe('montarUrlPhoton', () => {
  it('codifica o termo, pede 3x o limite e prioriza a caixa de MG', () => {
    const url = new URL(montarUrlPhoton('https://photon.exemplo/', 'rua da bahia 100', 5));
    expect(url.pathname).toBe('/api/');
    expect(url.searchParams.get('q')).toBe('rua da bahia 100');
    expect(url.searchParams.get('limit')).toBe('15');
    expect(url.searchParams.get('bbox')).toBe('-51.05,-22.93,-39.85,-14.22');
  });
});

describe('converterRespostaPhoton', () => {
  // Recorte da resposta real de q=savassi (nov/2026).
  const savassi = {
    features: [
      feature(
        { osm_key: 'place', osm_value: 'neighbourhood', type: 'locality', name: 'Savassi', district: 'Savassi', city: 'Belo Horizonte' },
        [-43.9355817, -19.937246],
      ),
      feature(
        { osm_key: 'place', osm_value: 'neighbourhood', type: 'locality', name: 'Savassi', city: 'Divinópolis' },
        [-44.8262704, -20.1378155],
      ),
      feature(
        { osm_key: 'boundary', osm_value: 'administrative', type: 'district', name: 'Savassi', city: 'Belo Horizonte' },
        [-43.9344463, -19.9352205],
      ),
      feature(
        { type: 'house', name: 'Savassi', street: 'Avenida João Arruda Brasil', city: 'Araçatuba', state: 'São Paulo' },
        [-50.4506038, -21.2067092],
      ),
    ],
  };

  it('mantém só MG, classifica como bairro e remove o mesmo bairro repetido', () => {
    expect(converterRespostaPhoton(savassi, 5)).toEqual([
      { nome: 'Savassi', descricao: 'Belo Horizonte', tipo: 'bairro', lat: -19.937246, lon: -43.9355817 },
      { nome: 'Savassi', descricao: 'Divinópolis', tipo: 'bairro', lat: -20.1378155, lon: -44.8262704 },
    ]);
  });

  it('respeita o limite', () => {
    expect(converterRespostaPhoton(savassi, 1)).toHaveLength(1);
  });

  it('endereço sem nome usa rua e número; descrição traz bairro e município', () => {
    const r = converterRespostaPhoton(
      { features: [feature({ type: 'house', street: 'Rua da Bahia', housenumber: '100', district: 'Centro', city: 'Belo Horizonte' }, [-43.93, -19.92])] },
      5,
    );
    expect(r).toEqual([{ nome: 'Rua da Bahia, 100', descricao: 'Centro, Belo Horizonte', tipo: 'endereco', lat: -19.92, lon: -43.93 }]);
  });

  it('rua, cidade e lugar com nome', () => {
    const r = converterRespostaPhoton(
      {
        features: [
          feature({ type: 'street', name: 'Avenida Afonso Pena', district: 'Centro', city: 'Belo Horizonte' }, [-43.93, -19.92]),
          feature({ type: 'city', name: 'Justinópolis', city: 'Ribeirão das Neves' }, [-44.03, -19.79]),
          feature({ type: 'house', name: 'Mercado Central', street: 'Avenida Augusto de Lima', city: 'Belo Horizonte' }, [-43.94, -19.92]),
        ],
      },
      5,
    );
    expect(r.map((l) => [l.tipo, l.descricao])).toEqual([
      ['rua', 'Centro, Belo Horizonte'],
      ['cidade', 'Ribeirão das Neves'],
      ['local', 'Avenida Augusto de Lima, Belo Horizonte'],
    ]);
  });

  it('descarta tipos amplos e coordenadas inválidas', () => {
    const r = converterRespostaPhoton(
      {
        features: [
          feature({ type: 'state', name: 'Minas Gerais' }, [-44.5, -18.5]),
          feature({ type: 'county', name: 'Região Imediata' }, [-44.5, -18.5]),
          { properties: { countrycode: 'BR', state: 'Minas Gerais', type: 'street', name: 'Rua X' }, geometry: { coordinates: 'x' } },
        ],
      },
      5,
    );
    expect(r).toEqual([]);
  });

  it('falha com resposta sem features', () => {
    expect(() => converterRespostaPhoton({}, 5)).toThrow();
    expect(() => converterRespostaPhoton(null, 5)).toThrow();
  });
});

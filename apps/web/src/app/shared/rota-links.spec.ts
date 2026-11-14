import { linksExternos } from './rota-links';

describe('links externos de rota', () => {
  const d = { lat: -19.9191, lon: -43.9386, nome: 'UPA Centro-Sul' };

  it('geo: com destino e nome codificado', () => {
    expect(linksExternos(d).geo).toBe('geo:-19.9191,-43.9386?q=-19.9191,-43.9386(UPA%20Centro-Sul)');
  });
  it('Google Maps com modo', () => {
    expect(linksExternos(d, 'pedestre').google).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-19.9191,-43.9386&travelmode=walking',
    );
  });
  it('OSM só com destino', () => {
    expect(linksExternos(d, 'bicicleta').osm).toBe(
      'https://www.openstreetmap.org/directions?engine=fossgis_osrm_bike&route=%3B-19.9191%2C-43.9386',
    );
  });
});

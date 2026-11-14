import type { ModoRota } from '@webgissus/domain';

export interface Destino {
  lat: number;
  lon: number;
  nome: string;
}

export interface LinksExternos {
  /** URI `geo:` — abre o app de mapas padrão no celular. */
  geo: string;
  google: string;
  osm: string;
}

const GOOGLE: Record<ModoRota, string> = { auto: 'driving', pedestre: 'walking', bicicleta: 'bicycling' };
const OSM: Record<ModoRota, string> = { auto: 'fossgis_osrm_car', pedestre: 'fossgis_osrm_foot', bicicleta: 'fossgis_osrm_bike' };

/**
 * Links para abrir o destino em outro app. Só o destino vai nos links: os apps
 * usam a posição do próprio aparelho como origem, então nada do usuário sai daqui.
 */
export function linksExternos(d: Destino, modo: ModoRota = 'auto'): LinksExternos {
  const par = `${d.lat},${d.lon}`;
  return {
    geo: `geo:${par}?q=${par}(${encodeURIComponent(d.nome)})`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${par}&travelmode=${GOOGLE[modo]}`,
    osm: `https://www.openstreetmap.org/directions?engine=${OSM[modo]}&route=%3B${encodeURIComponent(par)}`,
  };
}

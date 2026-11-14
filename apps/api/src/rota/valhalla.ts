import type { ModoRota, RotaDTO } from '@webgissus/domain';
import type { Coordenada } from '../common/params.js';
import { decodificarPolyline } from './polyline.js';

export const COSTING: Record<ModoRota, string> = {
  auto: 'auto',
  pedestre: 'pedestrian',
  bicicleta: 'bicycle',
};

export function montarCorpoValhalla(de: Coordenada, para: Coordenada, modo: ModoRota) {
  return {
    locations: [
      { lat: de.lat, lon: de.lon },
      { lat: para.lat, lon: para.lon },
    ],
    costing: COSTING[modo],
    directions_options: { language: 'pt-BR', units: 'kilometers' },
  };
}

interface ValhallaResposta {
  trip?: {
    summary: { length: number; time: number };
    legs: {
      shape: string;
      maneuvers: { instruction: string; length: number; time: number }[];
    }[];
  };
}

/** Converte a resposta do /route do Valhalla (km, s, shape polyline6) para RotaDTO. */
export function converterRespostaValhalla(resp: unknown, modo: ModoRota): RotaDTO {
  const trip = (resp as ValhallaResposta | null)?.trip;
  if (!trip?.legs?.length) throw new Error('resposta do Valhalla sem trip');
  const coordinates: [number, number][] = [];
  trip.legs.forEach((leg, idx) => {
    const pts = decodificarPolyline(leg.shape, 6);
    // O primeiro ponto de cada trecho repete o último do anterior.
    coordinates.push(...(idx === 0 ? pts : pts.slice(1)));
  });
  return {
    modo,
    distanciaM: Math.round(trip.summary.length * 1000),
    duracaoS: Math.round(trip.summary.time),
    geometria: { type: 'LineString', coordinates },
    passos: trip.legs.flatMap((leg) =>
      leg.maneuvers.map((m) => ({
        instrucao: m.instruction,
        distanciaM: Math.round(m.length * 1000),
        duracaoS: Math.round(m.time),
      })),
    ),
  };
}

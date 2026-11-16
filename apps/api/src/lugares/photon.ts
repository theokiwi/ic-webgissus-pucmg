import type { LugarDTO, TipoLugar } from '@webgissus/domain';
import { ENVELOPE_MG } from '../common/params.js';

/** Caixa de MG enviada ao Photon (lon_min, lat_min, lon_max, lat_max). Ela só prioriza; o filtro é `converterRespostaPhoton`. */
export const BBOX_PHOTON = '-51.05,-22.93,-39.85,-14.22';

/** Pede mais candidatos do que o limite: parte cai no filtro de MG e na remoção de duplicatas. */
export function montarUrlPhoton(base: string, q: string, limite: number): string {
  const params = new URLSearchParams({ q, limit: String(Math.min(limite * 3, 30)), bbox: BBOX_PHOTON });
  return `${base.replace(/\/+$/, '')}/api/?${params}`;
}

interface PropriedadesPhoton {
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  locality?: string;
  city?: string;
  state?: string;
  countrycode?: string;
}

interface FeaturePhoton {
  properties?: PropriedadesPhoton;
  geometry?: { type?: string; coordinates?: unknown };
}

const VALORES_BAIRRO = new Set(['suburb', 'neighbourhood', 'quarter', 'city_block', 'residential']);

function classificar(p: PropriedadesPhoton): TipoLugar | null {
  switch (p.type) {
    case 'house':
      return p.housenumber ? 'endereco' : 'local';
    case 'street':
      return 'rua';
    case 'district':
    case 'locality':
      return 'bairro';
    case 'city':
      return 'cidade';
    case 'other':
      return p.osm_key === 'place' && VALORES_BAIRRO.has(p.osm_value ?? '') ? 'bairro' : 'local';
    default:
      // county, state, country: amplos demais para "perto daqui".
      return null;
  }
}

function dentroDeMg(lon: number, lat: number): boolean {
  const { latMin, latMax, lonMin, lonMax } = ENVELOPE_MG;
  return lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax;
}

const chave = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * Converte o GeoJSON do Photon em LugarDTO: só resultados em Minas Gerais,
 * sem tipos amplos (estado, país) e sem repetir o mesmo lugar (nó e polígono do OSM).
 */
export function converterRespostaPhoton(resp: unknown, limite: number): LugarDTO[] {
  const features = (resp as { features?: FeaturePhoton[] } | null)?.features;
  if (!Array.isArray(features)) throw new Error('resposta do Photon sem features');

  const vistos = new Set<string>();
  const lugares: LugarDTO[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') continue;
    const [lon, lat] = coords as [number, number];
    if (p.countrycode !== 'BR' || p.state !== 'Minas Gerais' || !dentroDeMg(lon, lat)) continue;

    const tipo = classificar(p);
    const rua = p.street ? [p.street, p.housenumber].filter(Boolean).join(', ') : null;
    const nome = p.name ?? rua;
    if (!tipo || !nome) continue;

    const bairro = p.district ?? p.locality ?? null;
    const contexto = [rua, bairro, p.city].filter((s): s is string => !!s && chave(s) !== chave(nome));
    const descricao = [...new Set(contexto)].join(', ');

    const id = `${tipo}|${chave(nome)}|${chave(p.city ?? '')}`;
    if (vistos.has(id)) continue;
    vistos.add(id);

    lugares.push({ nome, descricao, tipo, lat, lon });
    if (lugares.length >= limite) break;
  }
  return lugares;
}

import { BadRequestException } from '@nestjs/common';
import type { CategoriaSlug, ModoRota } from '@webgissus/domain';
import { ehCategoria } from './categorias.js';

/** Envelope generoso de Minas Gerais. */
export const ENVELOPE_MG = { latMin: -24, latMax: -13, lonMin: -52, lonMax: -39 } as const;

export const LIMITE_PROXIMOS = { padrao: 20, max: 50 } as const;
export const RAIO_KM = { padrao: 30, max: 100 } as const;
export const LIMITE_BUSCA = { padrao: 10, max: 50 } as const;
export const BUSCA_MIN_CHARS = 3;

export type Texto = string | undefined;

export function parseDigitos(valor: Texto, n: number, nome: string): string {
  if (!valor || !new RegExp(`^\\d{${n}}$`).test(valor)) {
    throw new BadRequestException(`${nome} deve ter exatamente ${n} dígitos`);
  }
  return valor;
}

export function parseDigitosOpcional(valor: Texto, n: number, nome: string): string | null {
  if (valor === undefined || valor === '') return null;
  return parseDigitos(valor, n, nome);
}

export function parseCategoria(valor: Texto): CategoriaSlug | null {
  if (valor === undefined || valor === '') return null;
  if (!ehCategoria(valor)) throw new BadRequestException(`categoria inválida: ${valor}`);
  return valor;
}

export function parseNumero(valor: Texto, nome: string): number {
  if (valor === undefined || valor.trim() === '') {
    throw new BadRequestException(`${nome} é obrigatório`);
  }
  const n = Number(valor);
  if (!Number.isFinite(n)) throw new BadRequestException(`${nome} deve ser numérico`);
  return n;
}

/** Inteiro positivo com padrão e teto; acima do teto responde 400. */
export function parseInteiroLimitado(
  valor: Texto,
  nome: string,
  { padrao, max }: { padrao: number; max: number },
): number {
  if (valor === undefined || valor === '') return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new BadRequestException(`${nome} deve ser um inteiro entre 1 e ${max}`);
  }
  return n;
}

export function parseNumeroLimitado(
  valor: Texto,
  nome: string,
  { padrao, max }: { padrao: number; max: number },
): number {
  if (valor === undefined || valor === '') return padrao;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0 || n > max) {
    throw new BadRequestException(`${nome} deve ser maior que 0 e no máximo ${max}`);
  }
  return n;
}

export interface Coordenada {
  lat: number;
  lon: number;
}

export function validarCoordenada(lat: number, lon: number, nome = 'coordenada'): Coordenada {
  const { latMin, latMax, lonMin, lonMax } = ENVELOPE_MG;
  if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) {
    throw new BadRequestException(
      `${nome} fora do envelope de Minas Gerais (lat ${latMin}…${latMax}, lon ${lonMin}…${lonMax})`,
    );
  }
  return { lat, lon };
}

/** Aceita "lat,lon". */
export function parseParLatLon(valor: Texto, nome: string): Coordenada {
  if (!valor) throw new BadRequestException(`${nome} é obrigatório (formato lat,lon)`);
  const partes = valor.split(',');
  if (partes.length !== 2) throw new BadRequestException(`${nome} deve estar no formato lat,lon`);
  const lat = Number(partes[0]);
  const lon = Number(partes[1]);
  if (partes.some((p) => p.trim() === '') || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new BadRequestException(`${nome} deve estar no formato lat,lon numérico`);
  }
  return validarCoordenada(lat, lon, nome);
}

export interface ProximosParams extends Coordenada {
  categoria: CategoriaSlug | null;
  limite: number;
  raioKm: number;
}

export function parseProximos(q: Record<string, Texto>): ProximosParams {
  const coord = validarCoordenada(parseNumero(q.lat, 'lat'), parseNumero(q.lon, 'lon'), 'lat/lon');
  return {
    ...coord,
    categoria: parseCategoria(q.categoria),
    limite: parseInteiroLimitado(q.limite, 'limite', LIMITE_PROXIMOS),
    raioKm: parseNumeroLimitado(q.raioKm, 'raioKm', RAIO_KM),
  };
}

export interface BuscaParams {
  q: string;
  limite: number;
}

export function parseBusca(q: Record<string, Texto>): BuscaParams {
  const termo = (q.q ?? '').trim();
  if (termo.length < BUSCA_MIN_CHARS) {
    throw new BadRequestException(`q deve ter ao menos ${BUSCA_MIN_CHARS} caracteres`);
  }
  return { q: termo, limite: parseInteiroLimitado(q.limite, 'limite', LIMITE_BUSCA) };
}

export const LIMITE_LUGARES = { padrao: 5, max: 10 } as const;

export function parseLugares(q: Record<string, Texto>): BuscaParams {
  const termo = (q.q ?? '').trim().slice(0, 100);
  if (termo.length < BUSCA_MIN_CHARS) {
    throw new BadRequestException(`q deve ter ao menos ${BUSCA_MIN_CHARS} caracteres`);
  }
  return { q: termo, limite: parseInteiroLimitado(q.limite, 'limite', LIMITE_LUGARES) };
}

export const MODOS: readonly ModoRota[] = ['auto', 'pedestre', 'bicicleta'];

export interface RotaParams {
  de: Coordenada;
  para: Coordenada;
  modo: ModoRota;
}

export function parseRota(q: Record<string, Texto>): RotaParams {
  const modo = q.modo === undefined || q.modo === '' ? 'auto' : q.modo;
  if (!(MODOS as readonly string[]).includes(modo)) {
    throw new BadRequestException(`modo deve ser um de: ${MODOS.join(', ')}`);
  }
  return { de: parseParLatLon(q.de, 'de'), para: parseParLatLon(q.para, 'para'), modo: modo as ModoRota };
}

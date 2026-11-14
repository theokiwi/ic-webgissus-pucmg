import { BadRequestException } from '@nestjs/common';
import {
  parseBusca,
  parseCategoria,
  parseDigitos,
  parseParLatLon,
  parseProximos,
  parseRota,
} from './params.js';

describe('parseDigitos', () => {
  it('aceita só n dígitos', () => {
    expect(parseDigitos('3106200', 7, 'cd')).toBe('3106200');
    for (const ruim of ['', undefined, '310620', '31062000', '31062a0', ' 3106200'])
      expect(() => parseDigitos(ruim, 7, 'cd')).toThrow(BadRequestException);
  });
});

describe('parseCategoria', () => {
  it('lê slugs do JSON compartilhado', () => {
    expect(parseCategoria('hospital')).toBe('hospital');
    expect(parseCategoria(undefined)).toBeNull();
    expect(() => parseCategoria('xyz')).toThrow(BadRequestException);
  });
});

describe('parseParLatLon', () => {
  it('lê lat,lon', () => {
    expect(parseParLatLon('-19.9,-43.9', 'de')).toEqual({ lat: -19.9, lon: -43.9 });
  });
  it.each(['', '1', '-19.9,', ',-43.9', 'a,b', '-19.9,-43.9,1', '0,0', '-19.9,-60'])(
    'rejeita %j',
    (v) => {
      expect(() => parseParLatLon(v, 'de')).toThrow(BadRequestException);
    },
  );
});

describe('parseProximos', () => {
  const ok = { lat: '-19.9', lon: '-43.9' };
  it('aplica padrões', () => {
    expect(parseProximos(ok)).toEqual({ lat: -19.9, lon: -43.9, categoria: null, limite: 20, raioKm: 30 });
  });
  it('aceita valores no teto', () => {
    expect(parseProximos({ ...ok, limite: '50', raioKm: '100', categoria: 'farmacia' })).toMatchObject({
      limite: 50,
      raioKm: 100,
      categoria: 'farmacia',
    });
  });
  it.each([
    { lat: '-19.9' },
    { lat: 'x', lon: '-43.9' },
    { lat: '-10', lon: '-43.9' },
    { lat: '-19.9', lon: '-38' },
    { ...ok, limite: '51' },
    { ...ok, limite: '0' },
    { ...ok, limite: '1.5' },
    { ...ok, raioKm: '101' },
    { ...ok, raioKm: '0' },
    { ...ok, categoria: 'nada' },
  ])('rejeita %j', (q) => {
    expect(() => parseProximos(q)).toThrow(BadRequestException);
  });
});

describe('parseBusca', () => {
  it('exige 3 caracteres e aplica padrão', () => {
    expect(parseBusca({ q: ' sau ' })).toEqual({ q: 'sau', limite: 10 });
    expect(() => parseBusca({ q: 'sa' })).toThrow(BadRequestException);
    expect(() => parseBusca({})).toThrow(BadRequestException);
  });
});

describe('parseRota', () => {
  it('modo padrão auto', () => {
    expect(parseRota({ de: '-19.9,-43.9', para: '-19.8,-43.8' })).toMatchObject({ modo: 'auto' });
  });
  it('rejeita modo inválido', () => {
    expect(() => parseRota({ de: '-19.9,-43.9', para: '-19.8,-43.8', modo: 'x' })).toThrow(
      BadRequestException,
    );
  });
});

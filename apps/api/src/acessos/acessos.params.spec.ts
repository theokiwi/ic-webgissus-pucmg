import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseDiasAcessos, parseNovoAcesso } from './acessos.params.js';

describe('parseNovoAcesso', () => {
  it('aceita origem, meio e campanha no formato', () => {
    expect(parseNovoAcesso({ origem: 'instagram', meio: 'social', campanha: 'divulgacao', extra: 1 })).toEqual({
      origem: 'instagram',
      meio: 'social',
      campanha: 'divulgacao',
    });
  });

  it('rejeita campos ausentes, vazios, longos ou com caracteres fora do formato', () => {
    const ok = { origem: 'cartaz', meio: 'impresso', campanha: 'divulgacao' };
    for (const ruim of [
      undefined,
      {},
      { ...ok, origem: '' },
      { ...ok, meio: 'a'.repeat(41) },
      { ...ok, campanha: 'Divulgação' },
      { ...ok, origem: 7 },
      { ...ok, origem: "x'; drop table" },
    ]) {
      expect(() => parseNovoAcesso(ruim)).toThrow(BadRequestException);
    }
  });
});

describe('parseDiasAcessos', () => {
  it('padrão 30, teto 366', () => {
    expect(parseDiasAcessos({})).toBe(30);
    expect(parseDiasAcessos({ dias: '7' })).toBe(7);
    expect(() => parseDiasAcessos({ dias: '367' })).toThrow(BadRequestException);
    expect(() => parseDiasAcessos({ dias: '0' })).toThrow(BadRequestException);
  });
});

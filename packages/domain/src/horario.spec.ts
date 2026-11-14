import { describe, expect, it } from 'vitest';
import type { DiaSemana, HorarioDTO } from './api.js';
import { dataLocal, situacaoFuncionamento } from './horario.js';

/** Instante a partir de hora local de Brasília (UTC-3, sem horário de verão). */
function brt(iso: string): Date {
  return new Date(`${iso}-03:00`);
}
const h = (dia: DiaSemana, abre: string, fecha: string): HorarioDTO => ({ dia, abre, fecha });
// 2026-11-16 é segunda-feira.
const seg = (hhmm: string) => brt(`2026-11-16T${hhmm}:00`);

describe('situacaoFuncionamento', () => {
  it('sempreAberto vale 24h, mesmo com horários', () => {
    expect(situacaoFuncionamento([], true, seg('03:00')).estado).toBe('24h');
    expect(situacaoFuncionamento([h(1, '08:00', '09:00')], true, seg('12:00')).estado).toBe('24h');
  });

  it('sem horários e não sempre aberto: sem informação', () => {
    expect(situacaoFuncionamento([], false, seg('10:00')).estado).toBe('sem_informacao');
  });

  it('dentro e fora da faixa, com próxima mudança', () => {
    const hs = [h(1, '08:00', '17:00')];
    expect(situacaoFuncionamento(hs, false, seg('10:00'))).toEqual({
      estado: 'aberto',
      proximaMudanca: { tipo: 'fecha', dia: 1, hora: '17:00' },
    });
    expect(situacaoFuncionamento(hs, false, seg('08:00')).estado).toBe('aberto');
    expect(situacaoFuncionamento(hs, false, seg('17:00')).estado).toBe('fechado');
    expect(situacaoFuncionamento(hs, false, seg('07:59'))).toEqual({
      estado: 'fechado',
      proximaMudanca: { tipo: 'abre', dia: 1, hora: '08:00' },
    });
  });

  it('fechado: a próxima abertura pode estar na semana seguinte', () => {
    const r = situacaoFuncionamento([h(1, '08:00', '17:00')], false, seg('18:00'));
    expect(r).toEqual({ estado: 'fechado', proximaMudanca: { tipo: 'abre', dia: 1, hora: '08:00' } });
  });

  it('outro dia da semana não conta', () => {
    expect(situacaoFuncionamento([h(2, '08:00', '17:00')], false, seg('10:00')).estado).toBe('fechado');
  });

  it('faixa que atravessa a meia-noite conta no dia seguinte', () => {
    const hs = [h(1, '22:00', '02:00')];
    expect(situacaoFuncionamento(hs, false, seg('23:00')).estado).toBe('aberto');
    const terca1 = brt('2026-11-17T01:00:00');
    expect(situacaoFuncionamento(hs, false, terca1)).toEqual({
      estado: 'aberto',
      proximaMudanca: { tipo: 'fecha', dia: 2, hora: '02:00' },
    });
    expect(situacaoFuncionamento(hs, false, brt('2026-11-17T02:00:00')).estado).toBe('fechado');
    // segunda 01:00 ainda não: a faixa começa na segunda à noite.
    expect(situacaoFuncionamento(hs, false, seg('01:00')).estado).toBe('fechado');
  });

  it('sábado à noite atravessa para o domingo', () => {
    const hs = [h(6, '22:00', '06:00')];
    expect(situacaoFuncionamento(hs, false, brt('2026-11-22T03:00:00')).estado).toBe('aberto'); // domingo
  });

  it('23:59 como fim vale até o fim do dia', () => {
    const hs = [h(1, '00:00', '23:59')];
    expect(situacaoFuncionamento(hs, false, seg('23:59')).estado).toBe('aberto');
    expect(situacaoFuncionamento(hs, false, seg('23:30')).estado).toBe('aberto');
  });

  it('dias seguidos até 23:59 e a partir de 00:00 contam como contínuos', () => {
    const hs = [h(1, '08:00', '23:59'), h(2, '00:00', '06:00')];
    expect(situacaoFuncionamento(hs, false, seg('23:59'))).toEqual({
      estado: 'aberto',
      proximaMudanca: { tipo: 'fecha', dia: 2, hora: '06:00' },
    });
  });

  it('usa o fuso de Brasília, não o da máquina', () => {
    // 2026-11-16T11:00Z = 08:00 em Brasília (segunda); em UTC já seria 11:00.
    const instante = new Date('2026-11-16T11:00:00Z');
    expect(dataLocal(instante)).toEqual({ dia: 1, minuto: 8 * 60 });
    expect(situacaoFuncionamento([h(1, '08:00', '09:00')], false, instante).estado).toBe('aberto');
    // 02:00Z de terça = segunda 23:00 em Brasília.
    expect(dataLocal(new Date('2026-11-17T02:00:00Z'))).toEqual({ dia: 1, minuto: 23 * 60 });
  });

  it('ignora faixas inválidas', () => {
    expect(situacaoFuncionamento([h(1, 'xx', '10:00')], false, seg('09:00')).estado).toBe('sem_informacao');
  });
});

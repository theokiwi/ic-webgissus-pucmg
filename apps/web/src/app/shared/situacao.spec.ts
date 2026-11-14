import { descreverMudanca, rotuloSituacao } from './situacao';

describe('situação de funcionamento (textos)', () => {
  it('rótulos', () => {
    expect(rotuloSituacao({ estado: 'aberto' })).toBe('Aberto agora');
    expect(rotuloSituacao({ estado: 'fechado' })).toBe('Fechado');
    expect(rotuloSituacao({ estado: '24h' })).toBe('24 horas');
    expect(rotuloSituacao({ estado: 'sem_informacao' })).toBe('Horário não informado');
  });
  it('descreve a próxima mudança', () => {
    const seg = new Date('2026-11-16T13:00:00Z'); // segunda 10:00 em Brasília
    expect(descreverMudanca({ estado: 'aberto', proximaMudanca: { tipo: 'fecha', dia: 1, hora: '17:00' } }, seg)).toBe(
      'fecha às 17:00',
    );
    expect(descreverMudanca({ estado: 'fechado', proximaMudanca: { tipo: 'abre', dia: 3, hora: '08:00' } }, seg)).toBe(
      'abre qua às 08:00',
    );
    expect(descreverMudanca({ estado: 'fechado' }, seg)).toBe('');
  });
});

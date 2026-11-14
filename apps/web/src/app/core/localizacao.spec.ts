import { mensagemErroGeo } from './localizacao.service';
import { QUEBRAS_DENSIDADE_SETOR, CORES_DENSIDADE_SETOR, rotulosDensidadeSetor } from './setores';

describe('mensagens de geolocalização', () => {
  it('cada código tem uma mensagem própria e sempre sugere o mapa', () => {
    const msgs = [1, 2, 3, null].map(mensagemErroGeo);
    expect(new Set(msgs).size).toBe(4);
    for (const m of msgs) expect(m).toContain('mapa');
    expect(mensagemErroGeo(1)).toContain('negada');
  });
});

describe('classes de densidade dos setores', () => {
  it('há uma cor por classe e rótulos coerentes', () => {
    expect(CORES_DENSIDADE_SETOR.length).toBe(QUEBRAS_DENSIDADE_SETOR.length + 1);
    const r = rotulosDensidadeSetor(String);
    expect(r.length).toBe(CORES_DENSIDADE_SETOR.length);
    expect(r[0]).toBe('menos de 25');
    expect(r.at(-1)).toBe('10000 ou mais');
  });
  it('quebras crescentes', () => {
    expect([...QUEBRAS_DENSIDADE_SETOR].sort((a, b) => a - b)).toEqual([...QUEBRAS_DENSIDADE_SETOR]);
  });
});

import { competenciaIso, dataBr, decimal, distancia, duracao, enderecoLinhas, normalizar, numero, telefone, telefoneDigitos } from './formatadores';

describe('formatadores pt-BR', () => {
  it('numero usa ponto como separador de milhar', () => {
    expect(numero(1234567)).toBe('1.234.567');
    expect(numero(null)).toBe('—');
  });
  it('decimal usa vírgula', () => {
    expect(decimal(12.345, 1)).toBe('12,3');
    expect(decimal(undefined)).toBe('—');
  });
  it('competência AAAAMM vira AAAA-MM', () => {
    expect(competenciaIso('202609')).toBe('2026-09');
    expect(competenciaIso('2026-09')).toBe('2026-09');
  });
  it('telefone', () => {
    expect(telefone('3133334444')).toBe('(31) 3333-4444');
    expect(telefone('31999998888')).toBe('(31) 99999-8888');
    expect(telefoneDigitos('(31) 3333-4444')).toBe('3133334444');
    expect(telefoneDigitos('')).toBeNull();
  });
  it('endereço ignora partes vazias', () => {
    expect(
      enderecoLinhas({ logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cep: '30110000' }),
    ).toEqual(['Rua A, 10', 'Centro', 'CEP 30110-000']);
    expect(enderecoLinhas({ logradouro: null, numero: null, complemento: null, bairro: null, cep: null })).toEqual([]);
  });
  it('normalizar remove acentos e caixa', () => {
    expect(normalizar('  São João  ')).toBe('sao joao');
  });

  it('distância em m e km', () => {
    expect(distancia(28)).toBe('28 m');
    expect(distancia(186)).toBe('190 m');
    expect(distancia(996)).toBe('1,0 km');
    expect(distancia(1234)).toBe('1,2 km');
    expect(distancia(12_345)).toBe('12 km');
    expect(distancia(null)).toBe('—');
  });
  it('duração em min e h', () => {
    expect(duracao(20)).toBe('menos de 1 min');
    expect(duracao(505)).toBe('8 min');
    expect(duracao(3600)).toBe('1 h');
    expect(duracao(3900)).toBe('1 h 05 min');
    expect(duracao(-1)).toBe('—');
  });
});

describe('dataBr', () => {
  it('formata data simples e ISO com hora no fuso de Brasília', () => {
    expect(dataBr('2025-03-12')).toBe('12/03/2025');
    // 01h UTC ainda é o dia anterior em Brasília.
    expect(dataBr('2026-10-01T01:00:00.000Z')).toBe('30/09/2026');
  });

  it('vazio para ausente ou inválido', () => {
    expect(dataBr(null)).toBe('');
    expect(dataBr('ontem')).toBe('');
  });
});

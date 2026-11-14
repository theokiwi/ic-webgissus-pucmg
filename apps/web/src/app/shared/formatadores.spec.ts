import { competenciaIso, decimal, enderecoLinhas, normalizar, numero, telefone, telefoneDigitos } from './formatadores';

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
});

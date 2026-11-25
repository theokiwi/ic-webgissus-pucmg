import { describe, expect, it } from 'vitest';
import {
  dentroDaFaixa,
  ehIndicadorMunicipal,
  faixaValida,
  faixaVazia,
  valorIndicador,
  type ValoresMunicipio,
} from './pesquisa.js';

const bh: ValoresMunicipio = { populacao: 2_000_000, densidade: 6042, totalEstabelecimentos: 1500 };

describe('valorIndicador', () => {
  it('lê cada indicador', () => {
    expect(valorIndicador(bh, 'populacao')).toBe(2_000_000);
    expect(valorIndicador(bh, 'densidade')).toBe(6042);
    expect(valorIndicador(bh, 'total')).toBe(1500);
    expect(valorIndicador(bh, 'por10mil')).toBeCloseTo(7.5);
  });

  it('sem população, estabelecimentos por 10 mil é nulo', () => {
    expect(valorIndicador({ ...bh, populacao: null }, 'por10mil')).toBeNull();
    expect(valorIndicador({ ...bh, populacao: 0 }, 'por10mil')).toBeNull();
    expect(valorIndicador({ ...bh, densidade: null }, 'densidade')).toBeNull();
  });
});

describe('ehIndicadorMunicipal', () => {
  it('aceita só os quatro indicadores', () => {
    expect(ehIndicadorMunicipal('densidade')).toBe(true);
    expect(ehIndicadorMunicipal('area')).toBe(false);
    expect(ehIndicadorMunicipal(null)).toBe(false);
  });
});

describe('faixa', () => {
  it('mínimo inclusivo, máximo exclusivo (como a legenda)', () => {
    const f = { min: 10, max: 50 };
    expect(dentroDaFaixa(10, f)).toBe(true);
    expect(dentroDaFaixa(49.99, f)).toBe(true);
    expect(dentroDaFaixa(50, f)).toBe(false);
    expect(dentroDaFaixa(9.99, f)).toBe(false);
  });

  it('só um dos limites: "abaixo de" e "a partir de"', () => {
    expect(dentroDaFaixa(5, { min: null, max: 20 })).toBe(true);
    expect(dentroDaFaixa(20, { min: null, max: 20 })).toBe(false);
    expect(dentroDaFaixa(1e6, { min: 1000, max: null })).toBe(true);
    expect(dentroDaFaixa(999, { min: 1000, max: null })).toBe(false);
  });

  it('sem dado só passa quando não há limite', () => {
    expect(dentroDaFaixa(null, { min: null, max: null })).toBe(true);
    expect(dentroDaFaixa(null, { min: 0, max: null })).toBe(false);
    expect(dentroDaFaixa(null, { min: null, max: 10 })).toBe(false);
  });

  it('valida e reconhece faixa vazia', () => {
    expect(faixaVazia({ min: null, max: null })).toBe(true);
    expect(faixaVazia({ min: 0, max: null })).toBe(false);
    expect(faixaValida({ min: 1, max: 2 })).toBe(true);
    expect(faixaValida({ min: 2, max: 2 })).toBe(false);
    expect(faixaValida({ min: 3, max: 2 })).toBe(false);
    expect(faixaValida({ min: 3, max: null })).toBe(true);
  });
});

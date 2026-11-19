import { describe, expect, it } from 'vitest';
import {
  avisosDaFicha,
  avisoTipoUnidade,
  cadastroDesatualizado,
  competenciaPorExtenso,
  MESES_CADASTRO_ANTIGO,
  mesesDesdeAtualizacao,
  urlFichaCnes,
} from './transparencia.js';

describe('mesesDesdeAtualizacao', () => {
  it('conta meses inteiros até a competência', () => {
    expect(mesesDesdeAtualizacao('2026-09-30', '202609')).toBe(0);
    expect(mesesDesdeAtualizacao('2025-12-01', '202609')).toBe(9);
    expect(mesesDesdeAtualizacao('2024-09-15', '202609')).toBe(24);
  });

  it('sem data ou com formato inválido devolve null', () => {
    expect(mesesDesdeAtualizacao(null, '202609')).toBeNull();
    expect(mesesDesdeAtualizacao('15/09/2024', '202609')).toBeNull();
    expect(mesesDesdeAtualizacao('2024-09-15', '')).toBeNull();
  });
});

describe('cadastroDesatualizado (mais de 24 meses)', () => {
  it('o limite é 24 meses', () => {
    expect(MESES_CADASTRO_ANTIGO).toBe(24);
  });

  it('24 meses ainda não alerta; 25 alerta', () => {
    expect(cadastroDesatualizado('2024-09-01', '202609')).toBe(false);
    expect(cadastroDesatualizado('2024-08-31', '202609')).toBe(true);
    expect(cadastroDesatualizado('2015-01-10', '202609')).toBe(true);
  });

  it('sem data não alerta', () => {
    expect(cadastroDesatualizado(null, '202609')).toBe(false);
  });
});

describe('competenciaPorExtenso', () => {
  it('formata mês abreviado e ano', () => {
    expect(competenciaPorExtenso('202609')).toBe('set/2026');
    expect(competenciaPorExtenso('202601')).toBe('jan/2026');
  });

  it('devolve como veio quando não é AAAAMM válido', () => {
    expect(competenciaPorExtenso('202613')).toBe('202613');
    expect(competenciaPorExtenso('')).toBe('');
  });
});

describe('urlFichaCnes', () => {
  it('monta a ficha oficial pelo código da unidade (município DATASUS + CNES)', () => {
    expect(urlFichaCnes('3106200027049')).toBe(
      'https://cnes.datasus.gov.br/pages/estabelecimentos/ficha/index.jsp?coUnidade=3106200027049',
    );
  });

  it('rejeita códigos fora do formato', () => {
    expect(urlFichaCnes('0027049')).toBeNull();
    expect(urlFichaCnes('')).toBeNull();
  });
});

describe('avisoTipoUnidade', () => {
  it('explica os tipos que não são ponto de atendimento direto', () => {
    expect(avisoTipoUnidade(39)).toContain('encaminhamento');
    expect(avisoTipoUnidade(79)).toContain('órteses');
    expect(avisoTipoUnidade(85)).toContain('vacinação');
  });

  it('não avisa para tipos de atendimento comum', () => {
    expect(avisoTipoUnidade(1)).toBeNull();
    expect(avisoTipoUnidade(5)).toBeNull();
    expect(avisoTipoUnidade(73)).toBeNull();
  });

  it('código desconhecido não gera aviso', () => {
    expect(avisoTipoUnidade(999)).toBeNull();
  });
});

describe('avisosDaFicha', () => {
  it('junta o aviso do tipo e o de cadastro antigo', () => {
    const a = avisosDaFicha(79, '2015-01-10', '202609');
    expect(a).toHaveLength(2);
    expect(a[0]).toContain('órteses');
    expect(a[1]).toContain('dois anos');
  });

  it('só o de cadastro antigo quando o tipo é comum', () => {
    expect(avisosDaFicha(5, '2015-01-10', '202609')).toHaveLength(1);
  });

  it('só o do tipo quando o cadastro está recente', () => {
    expect(avisosDaFicha(39, '2026-09-01', '202609')).toHaveLength(1);
  });

  it('lista vazia quando não há nada a avisar', () => {
    expect(avisosDaFicha(5, '2026-09-01', '202609')).toEqual([]);
  });
});
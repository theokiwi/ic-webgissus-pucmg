import { describe, expect, it } from 'vitest';
import { ATALHOS_DIVULGACAO, origemDoAcesso, urlDivulgacao, type AtalhoDivulgacao } from './divulgacao.js';
import { comUtm } from './compartilhamento.js';

describe('urlDivulgacao', () => {
  it('leva cada atalho ao mapa com origem, meio e campanha de divulgação', () => {
    expect(urlDivulgacao('insta')).toBe('/?utm_source=instagram&utm_medium=social&utm_campaign=divulgacao');
    expect(urlDivulgacao('whats')).toBe('/?utm_source=whatsapp&utm_medium=social&utm_campaign=divulgacao');
    expect(urlDivulgacao('cartaz')).toBe('/?utm_source=cartaz&utm_medium=impresso&utm_campaign=divulgacao');
  });

  it('o destino de cada atalho é lido de volta como a própria origem', () => {
    for (const atalho of Object.keys(ATALHOS_DIVULGACAO) as AtalhoDivulgacao[]) {
      const o = origemDoAcesso(urlDivulgacao(atalho));
      expect(o).toEqual({ ...ATALHOS_DIVULGACAO[atalho], campanha: 'divulgacao' });
    }
  });
});

describe('origemDoAcesso', () => {
  it('sem utm_source não há acesso a contar', () => {
    expect(origemDoAcesso('')).toBeNull();
    expect(origemDoAcesso('/municipio/3106200?tema=densidade')).toBeNull();
    expect(origemDoAcesso('?utm_medium=social&utm_campaign=x')).toBeNull();
  });

  it('lê a origem de um link compartilhado pelo cidadão', () => {
    const url = comUtm('https://sus.exemplo.org/estabelecimento/0027049?tema=densidade', 'whatsapp');
    expect(origemDoAcesso(new URL(url).search)).toEqual({ origem: 'whatsapp', meio: 'social', campanha: 'compartilhar' });
  });

  it('normaliza maiúsculas, acentos e espaços; descarta valores fora do formato', () => {
    expect(origemDoAcesso('?utm_source=Instagram&utm_campaign=Campanha%20Março')).toEqual({
      origem: 'instagram',
      meio: 'nenhum',
      campanha: 'campanha-marco',
    });
    expect(origemDoAcesso('?utm_source=<script>')).toBeNull();
    expect(origemDoAcesso(`?utm_source=ok&utm_medium=${'a'.repeat(41)}`)).toEqual({ origem: 'ok', meio: 'nenhum', campanha: 'nenhum' });
  });

  it('aceita URLSearchParams', () => {
    expect(origemDoAcesso(new URLSearchParams('utm_source=cartaz&utm_medium=impresso'))?.origem).toBe('cartaz');
  });
});

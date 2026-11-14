import { describe, expect, it } from 'vitest';
import {
  comUtm,
  LIMITE_X,
  mensagemCompartilhamento,
  REDES,
  semUtm,
  urlCompartilhamento,
  type ContextoCompartilhamento,
} from './compartilhamento.js';

const LONGO = 'Hospital Municipal Doutor Fulano de Tal e Sicrano da Silva Sauro Júnior — Unidade de Pronto Atendimento Regional';
const CONTEXTOS: ContextoCompartilhamento[] = [
  { tipo: 'mg' },
  { tipo: 'municipio', nome: 'Belo Horizonte', totalEstabelecimentos: 1234, populacao: 2315560 },
  { tipo: 'municipio', nome: 'Serra da Saudade', totalEstabelecimentos: 1, populacao: null },
  { tipo: 'estabelecimento', nome: 'UBS Centro', categoriaRotulo: 'Atenção básica (UBS)', municipio: 'Uberaba', situacao: 'Aberto agora' },
  { tipo: 'estabelecimento', nome: LONGO, categoriaRotulo: 'Urgência (UPA/Pronto-socorro)', municipio: 'Sao Joao del Rei' },
  { tipo: 'perto' },
  { tipo: 'perto', categoriaRotulo: 'Farmácia' },
];
const URL_ATUAL = 'https://sus.exemplo.org/estabelecimento/0027618?tema=densidade&q=a b';

describe('mensagemCompartilhamento', () => {
  for (const rede of REDES) {
    for (const ctx of CONTEXTOS) {
      it(`${rede} × ${ctx.tipo}: texto e assunto preenchidos`, () => {
        const m = mensagemCompartilhamento(rede, ctx);
        expect(m.texto.length).toBeGreaterThan(10);
        expect(m.assunto.length).toBeGreaterThan(5);
      });
    }
  }

  it('X respeita o limite de 280 com o link de 23 caracteres e traz as hashtags', () => {
    for (const ctx of CONTEXTOS) {
      const { texto } = mensagemCompartilhamento('x', ctx);
      expect(texto.length + 1 + 23).toBeLessThanOrEqual(LIMITE_X);
      expect(texto).toContain('#SUS #MinasGerais');
    }
  });

  it('WhatsApp e Telegram têm emoji e quebra de linha; e-mail é formal', () => {
    const ctx = CONTEXTOS[1];
    expect(mensagemCompartilhamento('whatsapp', ctx).texto).toMatch(/^🏥 .*\n/s);
    expect(mensagemCompartilhamento('telegram', ctx).texto).toContain('\n\n');
    const mail = mensagemCompartilhamento('email', ctx).texto;
    expect(mail).toContain('Atenciosamente');
    expect(mail).not.toContain('🏥');
  });

  it('formata população em pt-BR e concorda singular/plural', () => {
    expect(mensagemCompartilhamento('whatsapp', CONTEXTOS[1]).texto).toContain('1.234 estabelecimentos');
    expect(mensagemCompartilhamento('whatsapp', CONTEXTOS[1]).texto).toContain('2.315.560 habitantes');
    const um = mensagemCompartilhamento('telegram', CONTEXTOS[2]).texto;
    expect(um).toContain('1 estabelecimento ');
    expect(um).not.toContain('habitantes');
  });

  it('inclui a situação quando informada e a categoria no contexto perto', () => {
    expect(mensagemCompartilhamento('whatsapp', CONTEXTOS[3]).texto).toContain('Aberto agora.');
    expect(mensagemCompartilhamento('telegram', CONTEXTOS[6]).texto).toContain('Farmácia');
  });

  it('não faz promessas médicas', () => {
    for (const rede of REDES)
      for (const ctx of CONTEXTOS) {
        expect(mensagemCompartilhamento(rede, ctx).texto.toLowerCase()).not.toMatch(/cura|garant/);
      }
  });
});

describe('UTM', () => {
  it('acrescenta utm por rede preservando caminho e parâmetros', () => {
    const u = new URL(comUtm(URL_ATUAL, 'whatsapp'));
    expect(u.pathname).toBe('/estabelecimento/0027618');
    expect(u.searchParams.get('tema')).toBe('densidade');
    expect(u.searchParams.get('q')).toBe('a b');
    expect(u.searchParams.get('utm_source')).toBe('whatsapp');
    expect(u.searchParams.get('utm_medium')).toBe('social');
    expect(u.searchParams.get('utm_campaign')).toBe('compartilhar');
  });

  it('substitui UTM antigos e semUtm os remove', () => {
    const u = comUtm(comUtm(URL_ATUAL, 'x'), 'telegram');
    expect(new URL(u).searchParams.getAll('utm_source')).toEqual(['telegram']);
    expect(semUtm(u)).not.toContain('utm_');
    expect(semUtm(u)).toContain('tema=densidade');
  });
});

describe('urlCompartilhamento', () => {
  const ctx = CONTEXTOS[3];
  const parametro = (href: string, nome: string) => new URL(href).searchParams.get(nome);

  it('WhatsApp: wa.me com texto + link com utm_source=whatsapp', () => {
    const href = urlCompartilhamento('whatsapp', URL_ATUAL, ctx);
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    const texto = parametro(href, 'text')!;
    expect(texto).toContain('UBS Centro');
    expect(texto).toContain('\n');
    expect(texto).toContain('utm_source=whatsapp');
    expect(href).not.toContain('\n');
  });

  it('Telegram: url e text separados', () => {
    const href = urlCompartilhamento('telegram', URL_ATUAL, ctx);
    expect(href.startsWith('https://t.me/share/url?')).toBe(true);
    expect(parametro(href, 'url')).toContain('utm_source=telegram');
    expect(parametro(href, 'text')).toContain('UBS Centro');
  });

  it('X: texto ≤ 280 e url com utm_source=x', () => {
    for (const c of CONTEXTOS) {
      const href = urlCompartilhamento('x', URL_ATUAL, c);
      expect(href.startsWith('https://twitter.com/intent/tweet?')).toBe(true);
      expect(`${parametro(href, 'text')} ${parametro(href, 'url')}`.length).toBeGreaterThan(0);
      expect(parametro(href, 'text')!.length + 1 + 23).toBeLessThanOrEqual(280);
      expect(parametro(href, 'url')).toContain('utm_source=x');
    }
  });

  it('Facebook e LinkedIn levam só a URL', () => {
    const fb = urlCompartilhamento('facebook', URL_ATUAL, ctx);
    expect(fb.startsWith('https://www.facebook.com/sharer/sharer.php?u=')).toBe(true);
    expect([...new URL(fb).searchParams.keys()]).toEqual(['u']);
    expect(parametro(fb, 'u')).toContain('utm_source=facebook');
    const li = urlCompartilhamento('linkedin', URL_ATUAL, ctx);
    expect(li.startsWith('https://www.linkedin.com/sharing/share-offsite/?url=')).toBe(true);
    expect([...new URL(li).searchParams.keys()]).toEqual(['url']);
    expect(parametro(li, 'url')).toContain('utm_source=linkedin');
  });

  it('E-mail: mailto com assunto e corpo codificados (espaço como %20, não +)', () => {
    const href = urlCompartilhamento('email', URL_ATUAL, ctx);
    expect(href.startsWith('mailto:?subject=')).toBe(true);
    expect(href).not.toContain('+');
    expect(decodeURIComponent(href.split('subject=')[1].split('&body=')[0])).toBe('UBS Centro — Uberaba (MG)');
    const corpo = decodeURIComponent(href.split('&body=')[1]);
    expect(corpo).toContain('Atenciosamente');
    expect(corpo).toContain('utm_source=email');
  });

  it('copiar e nativo devolvem o link com UTM da própria rede', () => {
    expect(urlCompartilhamento('copiar', URL_ATUAL, ctx)).toContain('utm_source=copiar');
    expect(urlCompartilhamento('nativo', URL_ATUAL, ctx)).toContain('utm_source=nativo');
  });

  it('o link dentro do intent decodifica de volta à URL do estado', () => {
    for (const rede of REDES) {
      const href = urlCompartilhamento(rede, URL_ATUAL, ctx);
      expect(href.length).toBeGreaterThan(20);
    }
    const link = parametro(urlCompartilhamento('telegram', URL_ATUAL, ctx), 'url')!;
    expect(new URL(semUtm(link)).searchParams.get('q')).toBe('a b');
    expect(new URL(semUtm(link)).pathname).toBe(new URL(URL_ATUAL).pathname);
  });
});

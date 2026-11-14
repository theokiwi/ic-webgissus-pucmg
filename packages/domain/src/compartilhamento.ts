/**
 * Textos e links de compartilhamento por rede social. Funções puras: o front só
 * decide o contexto (o que está sendo compartilhado) e a URL atual.
 */

export const REDES = ['nativo', 'whatsapp', 'telegram', 'x', 'facebook', 'linkedin', 'email', 'copiar'] as const;
export type Rede = (typeof REDES)[number];

export type ContextoCompartilhamento =
  | { tipo: 'mg' }
  | { tipo: 'municipio'; nome: string; totalEstabelecimentos: number; populacao: number | null }
  | { tipo: 'estabelecimento'; nome: string; categoriaRotulo: string; municipio: string; situacao?: string }
  | { tipo: 'perto'; categoriaRotulo?: string };

export interface MensagemCompartilhamento {
  /** Corpo da mensagem, sem o link (o link é anexado por `urlCompartilhamento`). */
  texto: string;
  /** Título/assunto (e-mail, Web Share API). */
  assunto: string;
}

/** O X conta qualquer link como 23 caracteres; sobra isto para o texto. */
export const LIMITE_X = 280;
const TAMANHO_LINK_X = 23;
const MAX_TEXTO_X = LIMITE_X - TAMANHO_LINK_X - 1;

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const num = (n: number): string => nf.format(n);

function cortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function estabelecimentos(n: number): string {
  return n === 1 ? '1 estabelecimento' : `${num(n)} estabelecimentos`;
}

interface Partes {
  /** Frase central, sem enfeites. */
  frase: string;
  /** Chamada adicional curta. */
  detalhe: string;
  assunto: string;
  /** Texto do X sem hashtags e já com limite aplicado depois. */
  curto: string;
}

function partes(ctx: ContextoCompartilhamento): Partes {
  switch (ctx.tipo) {
    case 'mg':
      return {
        frase: 'Mapa dos estabelecimentos de saúde que atendem pelo SUS em Minas Gerais.',
        detalhe: 'UBS, UPAs, hospitais e outros serviços gratuitos, com horários e rotas.',
        assunto: 'WebGIS SUS-MG: saúde gratuita pelo SUS em Minas Gerais',
        curto: 'Mapa dos estabelecimentos de saúde do SUS em Minas Gerais.',
      };
    case 'municipio': {
      const pop = ctx.populacao != null ? ` para ${num(ctx.populacao)} habitantes` : '';
      return {
        frase: `${ctx.nome} (MG) tem ${estabelecimentos(ctx.totalEstabelecimentos)} de saúde que atendem pelo SUS${pop}.`,
        detalhe: 'Veja onde ficam, horários e como chegar.',
        assunto: `Saúde pelo SUS em ${ctx.nome} (MG)`,
        curto: `${ctx.nome} (MG): ${estabelecimentos(ctx.totalEstabelecimentos)} de saúde pelo SUS.`,
      };
    }
    case 'estabelecimento': {
      const sit = ctx.situacao ? ` ${ctx.situacao}.` : '';
      return {
        frase: `${ctx.nome}: ${ctx.categoriaRotulo} em ${ctx.municipio} (MG), atende pelo SUS.${sit}`,
        detalhe: 'Veja endereço, telefone e horários. Confirme por telefone antes de ir.',
        assunto: `${ctx.nome} — ${ctx.municipio} (MG)`,
        curto: `${ctx.nome}, em ${ctx.municipio} (MG): ${ctx.categoriaRotulo} pelo SUS.${sit}`,
      };
    }
    case 'perto': {
      const cat = ctx.categoriaRotulo ? `: ${ctx.categoriaRotulo}` : '';
      return {
        frase: `Estabelecimentos de saúde do SUS perto de você em Minas Gerais${cat}.`,
        detalhe: 'Veja os mais próximos, horários e rotas.',
        assunto: `Saúde pelo SUS perto de mim${cat}`,
        curto: `Estabelecimentos do SUS perto de você${cat}.`,
      };
    }
  }
}

/** Mensagem personalizada para a rede; o link não está incluso. */
export function mensagemCompartilhamento(rede: Rede, ctx: ContextoCompartilhamento): MensagemCompartilhamento {
  const p = partes(ctx);
  const assunto = p.assunto;
  switch (rede) {
    case 'whatsapp':
      return { assunto, texto: `🏥 ${p.frase}\n${p.detalhe}` };
    case 'telegram':
      return { assunto, texto: `🏥 ${p.frase}\n\n${p.detalhe}` };
    case 'x': {
      const hashtags = '#SUS #MinasGerais';
      return { assunto, texto: `${cortar(p.curto, MAX_TEXTO_X - hashtags.length - 1)} ${hashtags}` };
    }
    case 'email':
      return {
        assunto,
        texto:
          `Olá,\n\nCompartilho com você uma consulta do WebGIS SUS-MG, mapa dos serviços de saúde ` +
          `acessíveis gratuitamente pelo SUS em Minas Gerais.\n\n${p.frase} ${p.detalhe}\n\nAtenciosamente,`,
      };
    case 'nativo':
    case 'facebook':
    case 'linkedin':
    case 'copiar':
      return { assunto, texto: `${p.frase} ${p.detalhe}` };
  }
}

/** Acrescenta `utm_source=<rede>&utm_medium=social&utm_campaign=compartilhar`, preservando a URL do estado. */
export function comUtm(url: string, rede: Rede): string {
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
  u.searchParams.set('utm_source', rede);
  u.searchParams.set('utm_medium', 'social');
  u.searchParams.set('utm_campaign', 'compartilhar');
  return u.toString();
}

/** Remove parâmetros UTM (URL canônica). */
export function semUtm(url: string): string {
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
  return u.toString();
}

/** Link final de cada rede (intents de compartilhamento) com mensagem e UTM próprios. */
export function urlCompartilhamento(rede: Rede, urlAtual: string, ctx: ContextoCompartilhamento): string {
  const link = comUtm(urlAtual, rede);
  const { texto, assunto } = mensagemCompartilhamento(rede, ctx);
  const enc = encodeURIComponent;
  switch (rede) {
    case 'whatsapp':
      return `https://wa.me/?text=${enc(`${texto}\n${link}`)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${enc(link)}&text=${enc(texto)}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${enc(texto)}&url=${enc(link)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link)}`;
    case 'email':
      return `mailto:?subject=${enc(assunto)}&body=${enc(`${texto}\n\n${link}`)}`;
    case 'nativo':
    case 'copiar':
      return link;
  }
}

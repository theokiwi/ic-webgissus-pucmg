/**
 * Links de divulgação por canal e leitura da origem de um acesso (ADR 0009).
 * O compartilhamento feito pelo cidadão usa `utm_campaign=compartilhar` (ver compartilhamento.ts);
 * a divulgação da equipe usa `utm_campaign=divulgacao`.
 */

export const CAMPANHA_DIVULGACAO = 'divulgacao';

/** Atalho curto (caminho no site) → parâmetros de origem. */
export const ATALHOS_DIVULGACAO = {
  insta: { origem: 'instagram', meio: 'social' },
  whats: { origem: 'whatsapp', meio: 'social' },
  cartaz: { origem: 'cartaz', meio: 'impresso' },
} as const;

export type AtalhoDivulgacao = keyof typeof ATALHOS_DIVULGACAO;

/** Destino do atalho: a visão inicial do mapa com os `utm_*` do canal. */
export function urlDivulgacao(atalho: AtalhoDivulgacao): string {
  const { origem, meio } = ATALHOS_DIVULGACAO[atalho];
  return `/?utm_source=${origem}&utm_medium=${meio}&utm_campaign=${CAMPANHA_DIVULGACAO}`;
}

/** O que é contado por acesso: nada além disto (sem IP, página ou identificador). */
export interface OrigemAcesso {
  origem: string;
  meio: string;
  campanha: string;
}

/** Formato aceito pela API para cada campo. */
export const VALOR_ORIGEM = /^[a-z0-9_-]{1,40}$/;
export const SEM_VALOR = 'nenhum';

function normalizar(v: string | null): string | null {
  if (v === null) return null;
  const s = v
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  return VALOR_ORIGEM.test(s) ? s : null;
}

/**
 * Origem do acesso a partir da query da URL. Sem `utm_source` válido não há o que contar (null);
 * meio ou campanha ausentes/inválidos viram `nenhum`.
 */
export function origemDoAcesso(consulta: string | URLSearchParams): OrigemAcesso | null {
  const p = typeof consulta === 'string' ? new URLSearchParams(consulta.replace(/^[^?]*\?/, '')) : consulta;
  const origem = normalizar(p.get('utm_source'));
  if (!origem) return null;
  return {
    origem,
    meio: normalizar(p.get('utm_medium')) ?? SEM_VALOR,
    campanha: normalizar(p.get('utm_campaign')) ?? SEM_VALOR,
  };
}

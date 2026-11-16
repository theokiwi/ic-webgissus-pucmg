import type { DiaSemana } from '@webgissus/domain';

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export function numero(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '—';
}

export function decimal(n: number | null | undefined, casas = 1): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Número com casas de acordo com a magnitude, para rótulos de legenda. */
export function numeroCompacto(n: number): string {
  if (Math.abs(n) >= 100) return numero(n);
  return n.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(n) >= 10 ? 1 : 2 });
}

/** '202609' → '2026-09'. */
export function competenciaIso(c: string): string {
  return /^\d{6}$/.test(c) ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Remove o que não é dígito; retorna null se vazio. */
export function telefoneDigitos(t: string | null | undefined): string | null {
  const d = (t ?? '').replace(/\D/g, '');
  return d || null;
}

/** Formata telefone brasileiro (8 a 11 dígitos); fora disso, devolve como veio. */
export function telefone(t: string | null | undefined): string {
  const d = telefoneDigitos(t);
  if (!d) return '';
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return (t ?? '').trim();
}

export function cep(c: string | null | undefined): string {
  const d = (c ?? '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (c ?? '').trim();
}

export function enderecoLinhas(e: {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
}): string[] {
  const rua = [e.logradouro, e.numero].filter((x) => !!x?.trim()).join(', ');
  const linhas = [
    [rua, e.complemento].filter((x) => !!x?.trim()).join(' - '),
    e.bairro?.trim() ?? '',
    e.cep ? `CEP ${cep(e.cep)}` : '',
  ];
  return linhas.filter(Boolean);
}

export const NOMES_DIA: readonly string[] = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/** Ordem de exibição: segunda a domingo. */
export const ORDEM_DIAS: readonly DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];

/** Para busca local: minúsculas e sem acentos. */
export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Distância legível: "850 m", "1,2 km", "12 km". */
export function distancia(m: number | null | undefined): string {
  if (typeof m !== 'number' || !Number.isFinite(m) || m < 0) return '—';
  const metros = m < 100 ? Math.round(m) : Math.round(m / 10) * 10;
  if (metros < 1000) return `${metros} m`;
  const km = m / 1000;
  return `${km >= 10 ? numero(km) : decimal(km, 1)} km`;
}

/** Duração legível: "menos de 1 min", "8 min", "1 h 05 min". */
export function duracao(s: number | null | undefined): string {
  if (typeof s !== 'number' || !Number.isFinite(s) || s < 0) return '—';
  const min = Math.round(s / 60);
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')} min`;
}

/** 'AAAA-MM-DD' (ou ISO com hora, lida no fuso de Brasília) → 'DD/MM/AAAA'; vazio se inválido. */
export function dataBr(d: string | null | undefined): string {
  if (!d) return '';
  const so = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (so) return `${so[3]}/${so[2]}/${so[1]}`;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

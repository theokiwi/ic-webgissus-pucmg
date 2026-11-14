import type { DiaSemana, HorarioDTO } from './api.js';

export const FUSO_PADRAO = 'America/Sao_Paulo';

export interface MudancaFuncionamento {
  /** O que acontece na próxima mudança de estado. */
  tipo: 'abre' | 'fecha';
  dia: DiaSemana;
  /** 'HH:MM' no fuso de Brasília. */
  hora: string;
}

export interface SituacaoFuncionamento {
  estado: 'aberto' | 'fechado' | '24h' | 'sem_informacao';
  /** Presente quando o estado é 'aberto' ou 'fechado' e há horários cadastrados. */
  proximaMudanca?: MudancaFuncionamento;
}

const MIN_DIA = 1440;
const MIN_SEMANA = 7 * MIN_DIA;

const DIAS_EN: Record<string, DiaSemana> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Dia da semana e minuto do dia em um fuso, independente do fuso da máquina. */
export function dataLocal(agora: Date, fuso: string = FUSO_PADRAO): { dia: DiaSemana; minuto: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const pega = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return {
    dia: DIAS_EN[pega('weekday')] ?? 0,
    minuto: (Number(pega('hour')) % 24) * 60 + Number(pega('minute')),
  };
}

/** 'HH:MM' (ou 'HH:MM:SS') em minutos desde 00:00; NaN se inválido. */
function emMinutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 24 || min > 59 ? NaN : h * 60 + min;
}

function formatarHora(minutoDoDia: number): string {
  const h = Math.floor(minutoDoDia / 60) % 24;
  const m = minutoDoDia % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Faixas absolutas [início, fim) em minutos desde domingo 00:00, já unidas
 * quando uma termina onde a outra começa (ex.: atravessa a meia-noite).
 */
function faixasDaSemana(horarios: HorarioDTO[]): [number, number][] {
  const faixas: [number, number][] = [];
  for (const h of horarios) {
    const abre = emMinutos(h.abre);
    let fecha = emMinutos(h.fecha);
    if (Number.isNaN(abre) || Number.isNaN(fecha) || abre === fecha) continue;
    // 23:59 como fim vale até o fim do dia.
    if (fecha === MIN_DIA - 1) fecha = MIN_DIA;
    const base = h.dia * MIN_DIA;
    // fecha < abre: a faixa atravessa a meia-noite e termina no dia seguinte.
    faixas.push([base + abre, base + (fecha > abre ? fecha : fecha + MIN_DIA)]);
  }
  faixas.sort((a, b) => a[0] - b[0]);
  const unidas: [number, number][] = [];
  for (const f of faixas) {
    const ult = unidas[unidas.length - 1];
    if (ult && f[0] <= ult[1]) ult[1] = Math.max(ult[1], f[1]);
    else unidas.push([f[0], f[1]]);
  }
  return unidas;
}

function mudanca(tipo: 'abre' | 'fecha', minutoAbsoluto: number): MudancaFuncionamento {
  const m = ((minutoAbsoluto % MIN_SEMANA) + MIN_SEMANA) % MIN_SEMANA;
  return { tipo, dia: Math.floor(m / MIN_DIA) as DiaSemana, hora: formatarHora(m % MIN_DIA) };
}

/**
 * Situação de funcionamento de um estabelecimento num instante, usando o
 * horário de Brasília. `sempreAberto` (TP_ESTAB_SEMPRE_ABERTO) vale como 24h.
 */
export function situacaoFuncionamento(
  horarios: HorarioDTO[],
  sempreAberto: boolean,
  agora: Date,
  fuso: string = FUSO_PADRAO,
): SituacaoFuncionamento {
  if (sempreAberto) return { estado: '24h' };
  const faixas = faixasDaSemana(horarios);
  if (faixas.length === 0) return { estado: 'sem_informacao' };

  const { dia, minuto } = dataLocal(agora, fuso);
  const t = dia * MIN_DIA + minuto;

  // Cópias deslocadas uma semana permitem olhar "à frente" sem tratar a virada.
  const todas: [number, number][] = [
    ...faixas,
    ...faixas.map(([a, b]): [number, number] => [a + MIN_SEMANA, b + MIN_SEMANA]),
  ];
  // Faixa do fim da semana que atravessa a virada (ex.: sábado 22:00 → domingo 02:00).
  const atual = todas.find(([a, b]) => (t >= a && t < b) || (t + MIN_SEMANA >= a && t + MIN_SEMANA < b));
  if (atual) {
    const tt = t >= atual[0] && t < atual[1] ? t : t + MIN_SEMANA;
    if (atual[1] - tt >= MIN_SEMANA) return { estado: 'aberto' };
    return { estado: 'aberto', proximaMudanca: mudanca('fecha', atual[1]) };
  }
  const proxima = todas.find(([a]) => a > t);
  return { estado: 'fechado', ...(proxima ? { proximaMudanca: mudanca('abre', proxima[0]) } : {}) };
}

import { dataLocal, type SituacaoFuncionamento } from '@webgissus/domain';

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function rotuloSituacao(s: SituacaoFuncionamento): string {
  switch (s.estado) {
    case 'aberto':
      return 'Aberto agora';
    case 'fechado':
      return 'Fechado';
    case '24h':
      return '24 horas';
    case 'sem_informacao':
      return 'Horário não informado';
  }
}

/** "fecha às 17:00" / "abre qua às 08:00"; vazio quando não há próxima mudança. */
export function descreverMudanca(s: SituacaoFuncionamento, agora: Date): string {
  const m = s.proximaMudanca;
  if (!m) return '';
  const hoje = dataLocal(agora).dia;
  const quando = m.dia === hoje ? `às ${m.hora}` : `${DIAS_CURTOS[m.dia]} às ${m.hora}`;
  return `${m.tipo === 'fecha' ? 'fecha' : 'abre'} ${quando}`;
}

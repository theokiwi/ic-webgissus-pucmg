/** Descrições CNES dos tipos de unidade do universo (ADR 0003). Fora da lista: "Tipo NN". */
const DESCRICOES: Record<number, string> = {
  1: 'Posto de saúde',
  2: 'Centro de saúde/Unidade básica',
  4: 'Policlínica',
  5: 'Hospital geral',
  7: 'Hospital especializado',
  15: 'Unidade mista',
  20: 'Pronto-socorro geral',
  21: 'Pronto-socorro especializado',
  22: 'Consultório isolado',
  36: 'Clínica/Centro de especialidade',
  39: 'Unidade de apoio diagnose e terapia (SADT isolado)',
  43: 'Farmácia',
  61: 'Centro de parto normal isolado',
  62: 'Hospital/Dia isolado',
  69: 'Centro de hemoterapia e hematologia',
  70: 'Centro de atenção psicossocial (CAPS)',
  73: 'Pronto atendimento (UPA)',
  74: 'Polo Academia da Saúde',
  79: 'Oficina ortopédica',
  83: 'Polo de prevenção de doenças e agravos e promoção da saúde',
  85: 'Centro de imunização',
};

export function descricaoTipoUnidade(codigo: number): string {
  return DESCRICOES[codigo] ?? `Tipo ${String(codigo).padStart(2, '0')}`;
}

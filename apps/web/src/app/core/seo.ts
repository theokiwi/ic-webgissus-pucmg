import { type EstabelecimentoDTO, type MunicipioDTO } from '@webgissus/domain';
import { decimal, numero } from '../shared/formatadores';

export const NOME_SITE = 'WebGIS SUS-MG';
export const DESCRICAO_PADRAO =
  'Mapa dos estabelecimentos de saúde acessíveis gratuitamente pelo SUS em Minas Gerais: UBS, UPAs, hospitais e mais, com horários, rotas e indicadores por município.';

export interface Metas {
  titulo: string;
  descricao: string;
  tipo: 'website';
}

/** Rota "tipada" a partir do caminho da URL (sem query). */
export type RotaSeo =
  | { tipo: 'mg' }
  | { tipo: 'macro' | 'regiao' | 'municipio'; cd: string }
  | { tipo: 'estabelecimento'; cnes: string }
  | { tipo: 'sobre' }
  | { tipo: 'privacidade' }
  | { tipo: 'perto' };

export function rotaSeo(caminho: string): RotaSeo {
  const [tipo, id, ...resto] = caminho.split('?')[0].split('#')[0].split('/').filter(Boolean).map(decodeURIComponent);
  if (resto.length === 0 && id && /^\d{1,12}$/.test(id)) {
    if (tipo === 'macro' || tipo === 'regiao' || tipo === 'municipio') return { tipo, cd: id };
    if (tipo === 'estabelecimento') return { tipo, cnes: id };
  }
  if (!id && (tipo === 'sobre' || tipo === 'privacidade' || tipo === 'perto')) return { tipo };
  return { tipo: 'mg' };
}

/** Caminho canônico (sem query nem UTM) da rota; rotas desconhecidas viram `/`. */
export function caminhoCanonico(r: RotaSeo): string {
  switch (r.tipo) {
    case 'mg':
      return '/';
    case 'macro':
    case 'regiao':
    case 'municipio':
      return `/${r.tipo}/${r.cd}`;
    case 'estabelecimento':
      return `/estabelecimento/${r.cnes}`;
    default:
      return `/${r.tipo}`;
  }
}

const sufixo = (t: string) => `${t} | ${NOME_SITE}`;

export const METAS_MG: Metas = {
  titulo: `${NOME_SITE} — Saúde gratuita pelo SUS em Minas Gerais`,
  descricao: DESCRICAO_PADRAO,
  tipo: 'website',
};

export const METAS_ESTATICAS: Record<'sobre' | 'privacidade' | 'perto', Metas> = {
  sobre: {
    titulo: sufixo('Sobre o projeto'),
    descricao:
      'O que é o WebGIS SUS-MG, de onde vêm os dados (CNES/DATASUS, IBGE, OpenStreetMap), como os estabelecimentos foram selecionados e quais são as limitações.',
    tipo: 'website',
  },
  privacidade: {
    titulo: sufixo('Privacidade'),
    descricao:
      'Como o WebGIS SUS-MG trata a sua localização e os seus dados: sem cadastro, sem cookies de rastreamento e sem armazenar a posição.',
    tipo: 'website',
  },
  perto: {
    titulo: sufixo('Estabelecimentos do SUS perto de você'),
    descricao: 'Encontre os estabelecimentos de saúde do SUS mais próximos de você em Minas Gerais, com horários e rotas.',
    tipo: 'website',
  },
};

export function metasMunicipio(m: MunicipioDTO): Metas {
  const pop = m.populacao != null ? ` para ${numero(m.populacao)} habitantes` : '';
  const taxa = m.estabelecimentosPor10mil != null ? ` (${decimal(m.estabelecimentosPor10mil, 1)} por 10 mil hab.)` : '';
  return {
    titulo: sufixo(`Saúde pelo SUS em ${m.nome} (MG)`),
    descricao: `${m.nome} tem ${numero(m.totalEstabelecimentos)} estabelecimentos de saúde que atendem pelo SUS${pop}${taxa}. Região de saúde ${m.nomeRegiao}, macrorregião ${m.nomeMacro}. Veja no mapa, com horários e rotas.`,
    tipo: 'website',
  };
}

export function metasEstabelecimento(e: EstabelecimentoDTO): Metas {
  const horario = e.sempreAberto ? ' Atendimento 24 horas.' : '';
  return {
    titulo: sufixo(`${e.nome} — ${e.municipio.nome} (MG)`),
    descricao: `${e.nome}: ${e.tipoUnidade.descricao} em ${e.municipio.nome} (MG), que atende pelo SUS.${horario} Veja endereço, telefone, horários e como chegar. Dados do CNES, competência ${e.competencia}; confirme por telefone antes de ir.`,
    tipo: 'website',
  };
}

export function metasRecorte(tipo: 'macro' | 'regiao', nome: string, totais: { municipios: number; estabelecimentos: number; populacao: number } | null): Metas {
  const rotulo = tipo === 'macro' ? 'Macrorregião de saúde' : 'Região de saúde';
  const resumo = totais
    ? ` Reúne ${numero(totais.municipios)} municípios, ${numero(totais.estabelecimentos)} estabelecimentos que atendem pelo SUS e ${numero(totais.populacao)} habitantes.`
    : '';
  return {
    titulo: sufixo(`${rotulo} ${nome} (MG)`),
    descricao: `${rotulo} ${nome}, em Minas Gerais.${resumo} Veja os municípios e estabelecimentos de saúde do SUS no mapa.`,
    tipo: 'website',
  };
}

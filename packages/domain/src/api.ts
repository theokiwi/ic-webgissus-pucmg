/**
 * Contrato HTTP entre apps/api e apps/web. Prefixo de todas as rotas: /api
 * Esquema do banco correspondente: infra/db/001_schema.sql
 */
import type { CategoriaSlug } from './categorias.js';

/** GET /api/meta */
export interface MetaDTO {
  competencia: string; // 'AAAAMM'
  atualizadoEm: string; // ISO 8601 da carga
  totais: { municipios: number; estabelecimentos: number; populacao: number };
  porCategoria: Record<CategoriaSlug, number>;
  /** true quando o servidor calcula e desenha rotas (Valhalla configurado); senão o site só oferece links externos. */
  rotas: boolean;
}

/** GET /api/regioes — macrorregiões com suas regiões de saúde (sem geometria). */
export interface MacrorregiaoDTO {
  cd: string;
  nome: string;
  bbox: BBox;
  regioes: { cd: string; nome: string; bbox: BBox }[];
}

/** [oeste, sul, leste, norte] em graus. */
export type BBox = [number, number, number, number];

/** GET /api/municipios?macro=&regiao= */
export interface MunicipioResumoDTO {
  cd: string; // IBGE 7 dígitos
  nome: string;
  cdRegiao: string;
  cdMacro: string;
  populacao: number | null;
  areaKm2: number | null;
  densidade: number | null;
  totalEstabelecimentos: number;
  porCategoria: Partial<Record<CategoriaSlug, number>>;
}

/** GET /api/municipios/:cd */
export interface MunicipioDTO extends MunicipioResumoDTO {
  nomeRegiao: string;
  nomeMacro: string;
  bbox: BBox;
  /** Estabelecimentos por 10 mil habitantes. */
  estabelecimentosPor10mil: number | null;
}

/** CO_NATUREZA_JUR do CNES, classificado pelo 1º dígito (ADR 0003). */
export type Natureza =
  | 'publica'
  | 'empresarial'
  | 'sem_fins_lucrativos'
  | 'pessoa_fisica'
  | 'nao_informada';

/** Propriedades de cada Feature em GET /api/municipios/:cd/estabelecimentos (GeoJSON FeatureCollection<Point>). */
export interface EstabelecimentoPontoProps {
  cnes: string;
  nome: string;
  categoria: CategoriaSlug;
  natureza: Natureza;
  bairro: string | null;
  sempreAberto: boolean;
  coordOk: boolean;
}

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo

export interface HorarioDTO {
  dia: DiaSemana;
  abre: string; // 'HH:MM'
  fecha: string; // 'HH:MM'
}

/** Filtro de rede de atendimento escolhido pelo usuário na interface. */
export type FiltroRede = 'todas' | 'publica' | 'privada';


/** GET /api/estabelecimentos/:cnes */
export interface EstabelecimentoDTO {
  cnes: string;
  /** CO_UNIDADE do CNES: município DATASUS (6 dígitos) + CNES; usado no link da ficha oficial. */
  codigoUnidade: string;
  nome: string;
  razaoSocial: string | null;
  categoria: CategoriaSlug;
  tipoUnidade: { codigo: number; descricao: string };
  municipio: { cd: string; nome: string };
  endereco: {
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cep: string | null;
  };
  telefone: string | null;
  email: string | null;
  natureza: Natureza;
  sempreAberto: boolean;
  turno: string | null;
  horarios: HorarioDTO[];
  servicos: { servico: string; classificacao: string | null; sus: boolean }[];
  atendimentos: { atendimento: string; sus: boolean }[];
  coordOk: boolean;
  /** Última atualização do cadastro pela unidade (DT_ATUALIZACAO do CNES). */
  atualizadoEm: string | null; // 'AAAA-MM-DD'
  lon: number;
  lat: number;
  competencia: string;
}

/** GET /api/estabelecimentos/proximos?lat=&lon=&categoria=&limite=20&raioKm=30 */
export interface ProximoDTO extends EstabelecimentoPontoProps {
  municipio: string;
  distanciaM: number; // em linha reta
  lon: number;
  lat: number;
  horarios: HorarioDTO[];
}

/** GET /api/estabelecimentos/busca?q=&limite=10 */
export interface BuscaItemDTO {
  cnes: string;
  nome: string;
  categoria: CategoriaSlug;
  natureza: Natureza;
  municipio: string;
  bairro: string | null;
}

export type TipoLugar = 'bairro' | 'rua' | 'endereco' | 'cidade' | 'local';

/** GET /api/lugares?q=&limite=5 — bairros, ruas e endereços de MG (geocodificador OSM, ADR 0008). */
export interface LugarDTO {
  nome: string;
  /** Contexto legível: rua, bairro e município, sem repetir o nome. */
  descricao: string;
  tipo: TipoLugar;
  lat: number;
  lon: number;
}

export type ModoRota = 'auto' | 'pedestre' | 'bicicleta';

/** GET /api/rota?de=lat,lon&para=lat,lon&modo=auto */
export interface RotaDTO {
  modo: ModoRota;
  distanciaM: number;
  duracaoS: number;
  geometria: { type: 'LineString'; coordinates: [number, number][] };
  passos: { instrucao: string; distanciaM: number; duracaoS: number }[];
}

/** Corpo de erro padrão. */
export interface ErroDTO {
  statusCode: number;
  message: string;
}

/** Linha de GET /api/acessos: acessos contados por dia (fuso de Brasília), origem, meio e campanha (ADR 0009). */
export interface AcessoDiarioDTO {
  dia: string; // 'AAAA-MM-DD'
  origem: string;
  meio: string;
  campanha: string;
  n: number;
}

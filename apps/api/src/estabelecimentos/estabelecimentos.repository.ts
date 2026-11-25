import { Inject, Injectable } from '@nestjs/common';
import { Db } from '../database/database.module.js';
import type { HorarioDTO, IndicadorMunicipal, PesquisaParamsDTO } from '@webgissus/domain';

export interface ProximoRow {
  cnes: string;
  nome: string;
  categoria: string;
  natureza: string;
  bairro: string | null;
  sempre_aberto: boolean;
  coord_ok: boolean;
  municipio: string;
  distancia_m: number;
  lon: number;
  lat: number;
  horarios: HorarioDTO[];
}

export interface BuscaRow {
  cnes: string;
  nome: string;
  categoria: string;
  natureza: string;
  municipio: string;
  bairro: string | null;
}

export interface EstabelecimentoRow {
  cnes: string;
  nome: string;
  razao_social: string | null;
  categoria: string;
  tp_unidade: number;
  cd_municipio: string;
  cd6_municipio: string;
  municipio: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  natureza: string;
  sempre_aberto: boolean;
  turno: string | null;
  coord_ok: boolean;
  atualizado_em: string | null;
  lon: number;
  lat: number;
  competencia: string | null;
}

export interface PesquisaRow {
  cnes: string;
  nome: string;
  categoria: string;
  natureza: string;
  tp_unidade: number;
  bairro: string | null;
  sempre_aberto: boolean;
  coord_ok: boolean;
  lon: number;
  lat: number;
  cd_municipio: string;
  municipio: string;
  valor: number | null;
}

export interface TipoRow {
  codigo: number;
  categoria: string;
  total: number;
}

/**
 * Valor de cada indicador municipal em SQL (aliases do CTE `ind` em `pesquisa`). Mesmo cálculo de
 * valorIndicador() em packages/domain/src/pesquisa.ts; o Record obriga a cobrir todos os critérios.
 */
const SQL_INDICADOR: Record<IndicadorMunicipal, string> = {
  populacao: 'm.populacao::float8',
  densidade: 'm.densidade',
  total: 'COALESCE(t.n, 0)::float8',
  por10mil: 'CASE WHEN m.populacao > 0 THEN COALESCE(t.n, 0) * 10000.0::float8 / m.populacao END',
};

const HORARIOS_JSON = `
  COALESCE((SELECT json_agg(json_build_object(
                     'dia', h.dia::int,
                     'abre', to_char(h.abre, 'HH24:MI'),
                     'fecha', to_char(h.fecha, 'HH24:MI')) ORDER BY h.dia, h.abre)
              FROM estabelecimento_horario h WHERE h.cnes = e.cnes), '[]'::json)`;

/** Escapa curingas do LIKE para que o termo seja literal. */
export function escaparLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class EstabelecimentosRepository {
  constructor(@Inject(Db) private readonly db: Db) {}

  /** KNN em geography (índice GiST sobre geom::geography); só coord_ok (ADR 0003). */
  proximos(lat: number, lon: number, categoria: string | null, limite: number, raioKm: number) {
    return this.db.linhas<ProximoRow>(
      `WITH ref AS (SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS g)
       SELECT e.cnes::text AS cnes, e.nome, e.categoria, e.natureza, e.bairro, e.sempre_aberto, e.coord_ok,
              m.nome AS municipio,
              ST_Distance(e.geom::geography, ref.g)::float8 AS distancia_m,
              ST_X(e.geom) AS lon, ST_Y(e.geom) AS lat,
              ${HORARIOS_JSON} AS horarios
         FROM ref, estabelecimento e
         JOIN municipio m ON m.cd = e.cd_municipio
        WHERE e.coord_ok
          AND ($3::text IS NULL OR e.categoria = $3)
          AND ST_DWithin(e.geom::geography, ref.g, $5::float8 * 1000)
        ORDER BY e.geom::geography <-> ref.g
        LIMIT $4`,
      [lat, lon, categoria, limite, raioKm],
    );
  }

  busca(q: string, limite: number) {
    return this.db.linhas<BuscaRow>(
      `SELECT e.cnes::text AS cnes, e.nome, e.categoria, e.natureza, m.nome AS municipio, e.bairro
         FROM estabelecimento e
         JOIN municipio m ON m.cd = e.cd_municipio
        WHERE f_unaccent(lower(e.nome)) LIKE '%' || f_unaccent(lower($1)) || '%'
        ORDER BY (f_unaccent(lower(e.nome)) LIKE f_unaccent(lower($1)) || '%') DESC,
                 similarity(f_unaccent(lower(e.nome)), f_unaccent(lower($2))) DESC,
                 e.nome
        LIMIT $3`,
      [escaparLike(q), q, limite],
    );
  }

  obter(cnes: string) {
    return this.db.primeira<EstabelecimentoRow>(
      `SELECT e.cnes::text AS cnes, e.nome, e.razao_social, e.categoria, e.tp_unidade::int AS tp_unidade,
              e.cd_municipio::text AS cd_municipio, m.cd6::text AS cd6_municipio, m.nome AS municipio,
              e.logradouro, e.numero, e.complemento, e.bairro, e.cep::text AS cep,
              e.telefone, e.email, e.natureza, e.sempre_aberto, e.turno, e.coord_ok,
              to_char(e.atualizado_em, 'YYYY-MM-DD') AS atualizado_em,
              ST_X(e.geom) AS lon, ST_Y(e.geom) AS lat,
              (SELECT competencia::text FROM carga ORDER BY id DESC LIMIT 1) AS competencia
         FROM estabelecimento e
         JOIN municipio m ON m.cd = e.cd_municipio
        WHERE e.cnes = $1`,
      [cnes],
    );
  }

  horarios(cnes: string) {
    return this.db.linhas<HorarioDTO>(
      `SELECT dia::int AS dia, to_char(abre, 'HH24:MI') AS abre, to_char(fecha, 'HH24:MI') AS fecha
         FROM estabelecimento_horario WHERE cnes = $1 ORDER BY dia, abre`,
      [cnes],
    );
  }

  servicos(cnes: string) {
    return this.db.linhas<{ servico: string; classificacao: string | null; sus: boolean }>(
      `SELECT servico, classificacao, sus FROM estabelecimento_servico
        WHERE cnes = $1 ORDER BY servico, classificacao`,
      [cnes],
    );
  }

  atendimentos(cnes: string) {
    return this.db.linhas<{ atendimento: string; sus: boolean }>(
      `SELECT atendimento, sus FROM estabelecimento_atendimento WHERE cnes = $1 ORDER BY atendimento`,
      [cnes],
    );
  }

  /** Quantidade de estabelecimentos por tipo de unidade (e a categoria em que o tipo cai). */
  tipos() {
    return this.db.linhas<TipoRow>(
      `SELECT tp_unidade::int AS codigo, categoria, count(*)::int AS total
         FROM estabelecimento GROUP BY tp_unidade, categoria`,
    );
  }

  /**
   * Estabelecimentos do tipo cujo município tem o indicador na faixa: min inclusivo, max exclusivo;
   * com algum limite, município sem dado fica de fora (regra em packages/domain/src/pesquisa.ts, ADR 0010).
   */
  pesquisa(p: PesquisaParamsDTO) {
    return this.db.linhas<PesquisaRow>(
      `WITH t AS (SELECT cd_municipio, count(*)::int AS n FROM estabelecimento GROUP BY cd_municipio),
            ind AS (
              SELECT m.cd, m.nome, ${SQL_INDICADOR[p.criterio]} AS valor
                FROM municipio m LEFT JOIN t ON t.cd_municipio = m.cd
               WHERE ($2::text IS NULL OR m.cd_macro = $2)
                 AND ($3::text IS NULL OR m.cd_regiao = $3))
       SELECT e.cnes::text AS cnes, e.nome, e.categoria, e.natureza, e.tp_unidade::int AS tp_unidade, e.bairro,
              e.sempre_aberto, e.coord_ok, ST_X(e.geom) AS lon, ST_Y(e.geom) AS lat,
              ind.cd::text AS cd_municipio, ind.nome AS municipio, ind.valor::float8 AS valor
         FROM estabelecimento e
         JOIN ind ON ind.cd = e.cd_municipio
        WHERE e.tp_unidade = $1
          AND (($4::float8 IS NULL AND $5::float8 IS NULL)
               OR (ind.valor IS NOT NULL
                   AND ($4::float8 IS NULL OR ind.valor >= $4)
                   AND ($5::float8 IS NULL OR ind.valor < $5)))
        ORDER BY ind.valor DESC NULLS LAST, ind.nome, e.nome, e.cnes`,
      [p.tipo, p.macro, p.regiao, p.min, p.max],
    );
  }
}

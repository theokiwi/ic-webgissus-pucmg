import { Inject, Injectable } from '@nestjs/common';
import { Db } from '../database/database.module.js';

export interface MunicipioRow {
  cd: string;
  nome: string;
  cd_regiao: string;
  cd_macro: string;
  populacao: number | null;
  area_km2: number | null;
  densidade: number | null;
  por_categoria: Record<string, number>;
}

export interface MunicipioDetalheRow extends MunicipioRow {
  nome_regiao: string;
  nome_macro: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

export interface PontoRow {
  cnes: string;
  nome: string;
  categoria: string;
  natureza: string;
  bairro: string | null;
  sempre_aberto: boolean;
  coord_ok: boolean;
  lon: number;
  lat: number;
}

const CONTAGEM = `
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_object_agg(categoria, n), '{}'::jsonb) AS por
      FROM (SELECT categoria, count(*)::int AS n
              FROM estabelecimento e WHERE e.cd_municipio = m.cd GROUP BY categoria) x
  ) c ON true`;

@Injectable()
export class MunicipiosRepository {
  constructor(@Inject(Db) private readonly db: Db) {}

  listar(macro: string | null, regiao: string | null) {
    return this.db.linhas<MunicipioRow>(
      `SELECT m.cd::text AS cd, m.nome, m.cd_regiao::text AS cd_regiao, m.cd_macro::text AS cd_macro,
              m.populacao, m.area_km2, m.densidade, c.por AS por_categoria
         FROM municipio m ${CONTAGEM}
        WHERE ($1::text IS NULL OR m.cd_macro = $1)
          AND ($2::text IS NULL OR m.cd_regiao = $2)
        ORDER BY m.nome`,
      [macro, regiao],
    );
  }

  obter(cd: string) {
    return this.db.primeira<MunicipioDetalheRow>(
      `SELECT m.cd::text AS cd, m.nome, m.cd_regiao::text AS cd_regiao, m.cd_macro::text AS cd_macro,
              m.populacao, m.area_km2, m.densidade, c.por AS por_categoria,
              r.nome AS nome_regiao, mc.nome AS nome_macro,
              ST_XMin(m.geom) AS xmin, ST_YMin(m.geom) AS ymin,
              ST_XMax(m.geom) AS xmax, ST_YMax(m.geom) AS ymax
         FROM municipio m
         JOIN regiao_saude r ON r.cd = m.cd_regiao
         JOIN macrorregiao mc ON mc.cd = m.cd_macro
         ${CONTAGEM}
        WHERE m.cd = $1`,
      [cd],
    );
  }

  async existe(cd: string) {
    return (await this.db.primeira(`SELECT 1 FROM municipio WHERE cd = $1`, [cd])) !== null;
  }

  pontos(cd: string, categoria: string | null) {
    return this.db.linhas<PontoRow>(
         `SELECT e.cnes::text AS cnes, e.nome, e.categoria, e.natureza, e.bairro, e.sempre_aberto, e.coord_ok,
              ST_X(e.geom) AS lon, ST_Y(e.geom) AS lat
         FROM estabelecimento e
        WHERE e.cd_municipio = $1 AND ($2::text IS NULL OR e.categoria = $2)
        ORDER BY e.nome, e.cnes`,
      [cd, categoria],
    );
  }
}

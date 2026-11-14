import { Inject, Injectable } from '@nestjs/common';
import { Db } from '../database/database.module.js';

export interface UnidadeRow {
  cd: string;
  nome: string;
  cd_macro?: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

@Injectable()
export class RegioesRepository {
  constructor(@Inject(Db) private readonly db: Db) {}

  macrorregioes() {
    return this.db.linhas<UnidadeRow>(
      `SELECT cd::text AS cd, nome,
              ST_XMin(ST_Extent(geom)) AS xmin, ST_YMin(ST_Extent(geom)) AS ymin,
              ST_XMax(ST_Extent(geom)) AS xmax, ST_YMax(ST_Extent(geom)) AS ymax
         FROM macrorregiao GROUP BY cd, nome ORDER BY nome`,
    );
  }

  regioes() {
    return this.db.linhas<UnidadeRow>(
      `SELECT cd::text AS cd, nome, cd_macro::text AS cd_macro,
              ST_XMin(ST_Extent(geom)) AS xmin, ST_YMin(ST_Extent(geom)) AS ymin,
              ST_XMax(ST_Extent(geom)) AS xmax, ST_YMax(ST_Extent(geom)) AS ymax
         FROM regiao_saude GROUP BY cd, nome, cd_macro ORDER BY nome`,
    );
  }
}

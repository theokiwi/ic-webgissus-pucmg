import { Inject, Injectable } from '@nestjs/common';
import { Db } from '../database/database.module.js';

export interface CargaRow {
  competencia: string;
  atualizado_em: Date;
}

@Injectable()
export class MetaRepository {
  constructor(@Inject(Db) private readonly db: Db) {}

  ultimaCarga() {
    return this.db.primeira<CargaRow>(
      `SELECT competencia::text AS competencia, executada_em AS atualizado_em
         FROM carga ORDER BY id DESC LIMIT 1`,
    );
  }

  async totais() {
    const r = await this.db.primeira<{ municipios: number; estabelecimentos: number; populacao: number }>(
      `SELECT (SELECT count(*) FROM municipio)::int AS municipios,
              (SELECT count(*) FROM estabelecimento)::int AS estabelecimentos,
              (SELECT COALESCE(sum(populacao), 0) FROM municipio)::float8 AS populacao`,
    );
    return r!;
  }

  porCategoria() {
    return this.db.linhas<{ categoria: string; n: number }>(
      `SELECT categoria, count(*)::int AS n FROM estabelecimento GROUP BY categoria`,
    );
  }
}

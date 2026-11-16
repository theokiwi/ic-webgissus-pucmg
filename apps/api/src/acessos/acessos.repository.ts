import { Inject, Injectable } from '@nestjs/common';
import { Db } from '../database/database.module.js';
import type { NovoAcesso } from './acessos.params.js';

export interface AcessoRow {
  dia: string;
  origem: string;
  meio: string;
  campanha: string;
  n: number;
}

const HOJE_BRASILIA = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`;

@Injectable()
export class AcessosRepository {
  constructor(@Inject(Db) private readonly db: Db) {}

  /** Soma +1 no dia (fuso de Brasília); a linha nasce na primeira vez. */
  async somar(a: NovoAcesso): Promise<void> {
    await this.db.linhas(
      `INSERT INTO acesso_diario (dia, origem, meio, campanha, n)
       VALUES (${HOJE_BRASILIA}, $1, $2, $3, 1)
       ON CONFLICT (dia, origem, meio, campanha) DO UPDATE SET n = acesso_diario.n + 1`,
      [a.origem, a.meio, a.campanha],
    );
  }

  /** Totais dos últimos `dias` dias (hoje incluído), do mais recente ao mais antigo. */
  listar(dias: number) {
    return this.db.linhas<AcessoRow>(
      `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, origem, meio, campanha, n
         FROM acesso_diario
        WHERE dia > ${HOJE_BRASILIA} - $1::int
        ORDER BY dia DESC, n DESC, origem, meio, campanha`,
      [dias],
    );
  }
}

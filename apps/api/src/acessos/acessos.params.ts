import { BadRequestException } from '@nestjs/common';
import { parseInteiroLimitado, type Texto } from '../common/params.js';

/** Mesmo formato de `VALOR_ORIGEM` em packages/domain/src/divulgacao.ts (a API só importa tipos do domain). */
const VALOR = /^[a-z0-9_-]{1,40}$/;

export interface NovoAcesso {
  origem: string;
  meio: string;
  campanha: string;
}

export const DIAS_ACESSOS = { padrao: 30, max: 366 } as const;

export function parseNovoAcesso(corpo: unknown): NovoAcesso {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const campo = (nome: keyof NovoAcesso): string => {
    const v = c[nome];
    if (typeof v !== 'string' || !VALOR.test(v)) {
      throw new BadRequestException(`${nome} deve ter de 1 a 40 caracteres entre a-z, 0-9, _ e -`);
    }
    return v;
  };
  return { origem: campo('origem'), meio: campo('meio'), campanha: campo('campanha') };
}

export function parseDiasAcessos(q: Record<string, Texto>): number {
  return parseInteiroLimitado(q.dias, 'dias', DIAS_ACESSOS);
}

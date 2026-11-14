import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RotaDTO } from '@webgissus/domain';
import type { RotaParams } from '../common/params.js';
import { converterRespostaValhalla, montarCorpoValhalla } from './valhalla.js';

export const TIMEOUT_VALHALLA_MS = 10_000;

@Injectable()
export class RotaService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async calcular({ de, para, modo }: RotaParams): Promise<RotaDTO> {
    const base = this.config.get<string>('VALHALLA_URL');
    if (!base) throw new ServiceUnavailableException('Serviço de rotas não configurado (VALHALLA_URL)');

    let resp: Response;
    try {
      resp = await fetch(`${base.replace(/\/+$/, '')}/route`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(montarCorpoValhalla(de, para, modo)),
        signal: AbortSignal.timeout(TIMEOUT_VALHALLA_MS),
      });
    } catch {
      throw new ServiceUnavailableException('Serviço de rotas indisponível');
    }
    if (!resp.ok) {
      throw new ServiceUnavailableException(`Serviço de rotas respondeu ${resp.status}`);
    }
    try {
      return converterRespostaValhalla(await resp.json(), modo);
    } catch {
      throw new ServiceUnavailableException('Resposta inválida do serviço de rotas');
    }
  }
}

import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LugarDTO } from '@webgissus/domain';
import type { BuscaParams } from '../common/params.js';
import { converterRespostaPhoton, montarUrlPhoton } from './photon.js';

export const GEOCODER_URL_PADRAO = 'https://photon.komoot.io';
export const TIMEOUT_GEOCODER_MS = 5_000;
/** Identifica o projeto ao serviço público (política de uso do Photon/OSM), sem dados de pessoas. */
export const USER_AGENT = 'WebGIS-SUS-MG/1.0 (projeto de pesquisa)';

/**
 * Busca bairros e endereços no Photon (geocodificador do OpenStreetMap). A chamada sai do
 * servidor: o IP de quem pesquisa não chega ao serviço externo (ADR 0008).
 */
@Injectable()
export class LugaresService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async buscar({ q, limite }: BuscaParams): Promise<LugarDTO[]> {
    const base = this.config.get<string>('GEOCODER_URL') || GEOCODER_URL_PADRAO;
    let resp: Response;
    try {
      resp = await fetch(montarUrlPhoton(base, q, limite), {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_GEOCODER_MS),
      });
    } catch {
      throw new ServiceUnavailableException('Busca de endereços indisponível');
    }
    if (!resp.ok) throw new ServiceUnavailableException(`Busca de endereços respondeu ${resp.status}`);
    try {
      return converterRespostaPhoton(await resp.json(), limite);
    } catch {
      throw new ServiceUnavailableException('Resposta inválida da busca de endereços');
    }
  }
}

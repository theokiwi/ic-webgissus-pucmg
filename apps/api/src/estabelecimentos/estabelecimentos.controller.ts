import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BuscaPipe, CnesPipe, PesquisaPipe, ProximosPipe } from '../common/pipes.js';
import type { BuscaParams, ProximosParams } from '../common/params.js';
import type { PesquisaParamsDTO } from '@webgissus/domain';
import { EstabelecimentosService } from './estabelecimentos.service.js';

@ApiTags('estabelecimentos')
@Controller('estabelecimentos')
export class EstabelecimentosController {
  constructor(@Inject(EstabelecimentosService) private readonly service: EstabelecimentosService) {}

  // Rotas fixas antes de :cnes.
  @Get('proximos')
  proximos(@Query(ProximosPipe) p: ProximosParams) {
    return this.service.proximos(p);
  }

  @Get('busca')
  busca(@Query(BuscaPipe) p: BuscaParams) {
    return this.service.busca(p);
  }

  @Get('tipos')
  tipos() {
    return this.service.tipos();
  }

  /** Tipo de unidade + faixa de um indicador do município (ADR 0010). */
  @Get('pesquisa')
  pesquisa(@Query(PesquisaPipe) p: PesquisaParamsDTO) {
    return this.service.pesquisa(p);
  }

  @Get(':cnes')
  obter(@Param('cnes', CnesPipe) cnes: string) {
    return this.service.obter(cnes);
  }
}

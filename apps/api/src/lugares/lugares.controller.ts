import { Controller, Get, Header, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LugaresPipe } from '../common/pipes.js';
import type { BuscaParams } from '../common/params.js';
import { LugaresService } from './lugares.service.js';

@ApiTags('lugares')
@Controller('lugares')
export class LugaresController {
  constructor(@Inject(LugaresService) private readonly service: LugaresService) {}

  /** Cache na CDN: o mesmo termo não volta ao serviço externo por um dia. */
  @Get()
  @Header('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  buscar(@Query(LugaresPipe) p: BuscaParams) {
    return this.service.buscar(p);
  }
}

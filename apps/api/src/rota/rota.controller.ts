import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RotaPipe } from '../common/pipes.js';
import type { RotaParams } from '../common/params.js';
import { RotaService } from './rota.service.js';

@ApiTags('rota')
@Controller('rota')
export class RotaController {
  constructor(@Inject(RotaService) private readonly service: RotaService) {}

  @Get()
  calcular(@Query(RotaPipe) p: RotaParams) {
    return this.service.calcular(p);
  }
}

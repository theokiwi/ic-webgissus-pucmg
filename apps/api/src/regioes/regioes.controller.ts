import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegioesService } from './regioes.service.js';

@ApiTags('regioes')
@Controller('regioes')
export class RegioesController {
  constructor(@Inject(RegioesService) private readonly service: RegioesService) {}

  @Get()
  listar() {
    return this.service.listar();
  }
}

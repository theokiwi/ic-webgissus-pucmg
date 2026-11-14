import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MetaService } from './meta.service.js';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(@Inject(MetaService) private readonly service: MetaService) {}

  @Get()
  obter() {
    return this.service.obter();
  }
}

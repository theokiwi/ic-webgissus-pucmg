import { Module } from '@nestjs/common';
import { RegioesController } from './regioes.controller.js';
import { RegioesRepository } from './regioes.repository.js';
import { RegioesService } from './regioes.service.js';

@Module({
  controllers: [RegioesController],
  providers: [RegioesService, RegioesRepository],
})
export class RegioesModule {}

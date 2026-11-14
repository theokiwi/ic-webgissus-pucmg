import { Module } from '@nestjs/common';
import { MetaController } from './meta.controller.js';
import { MetaRepository } from './meta.repository.js';
import { MetaService } from './meta.service.js';

@Module({
  controllers: [MetaController],
  providers: [MetaService, MetaRepository],
  exports: [MetaRepository],
})
export class MetaModule {}

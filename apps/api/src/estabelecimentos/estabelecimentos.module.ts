import { Module } from '@nestjs/common';
import { EstabelecimentosController } from './estabelecimentos.controller.js';
import { EstabelecimentosRepository } from './estabelecimentos.repository.js';
import { EstabelecimentosService } from './estabelecimentos.service.js';

@Module({
  controllers: [EstabelecimentosController],
  providers: [EstabelecimentosService, EstabelecimentosRepository],
})
export class EstabelecimentosModule {}

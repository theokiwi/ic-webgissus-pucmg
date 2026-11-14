import { Module } from '@nestjs/common';
import { MunicipiosController } from './municipios.controller.js';
import { MunicipiosRepository } from './municipios.repository.js';
import { MunicipiosService } from './municipios.service.js';

@Module({
  controllers: [MunicipiosController],
  providers: [MunicipiosService, MunicipiosRepository],
})
export class MunicipiosModule {}

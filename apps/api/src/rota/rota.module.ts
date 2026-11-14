import { Module } from '@nestjs/common';
import { RotaController } from './rota.controller.js';
import { RotaService } from './rota.service.js';

@Module({ controllers: [RotaController], providers: [RotaService] })
export class RotaModule {}

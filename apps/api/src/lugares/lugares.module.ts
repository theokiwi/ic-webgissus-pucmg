import { Module } from '@nestjs/common';
import { LugaresController } from './lugares.controller.js';
import { LugaresService } from './lugares.service.js';

@Module({ controllers: [LugaresController], providers: [LugaresService] })
export class LugaresModule {}

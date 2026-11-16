import { Module } from '@nestjs/common';
import { AcessosController } from './acessos.controller.js';
import { AcessosRepository } from './acessos.repository.js';

@Module({ controllers: [AcessosController], providers: [AcessosRepository] })
export class AcessosModule {}

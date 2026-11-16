import { Body, Controller, Get, Header, HttpCode, Inject, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AcessoDiarioDTO } from '@webgissus/domain';
import type { Texto } from '../common/params.js';
import { parseDiasAcessos, parseNovoAcesso } from './acessos.params.js';
import { AcessosRepository } from './acessos.repository.js';

/** Contagem anônima de acessos por origem (ADR 0009): sem IP, cookie nem identificador. */
@ApiTags('acessos')
@Controller('acessos')
export class AcessosController {
  constructor(@Inject(AcessosRepository) private readonly repo: AcessosRepository) {}

  @Post()
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async registrar(@Body() corpo: unknown): Promise<void> {
    await this.repo.somar(parseNovoAcesso(corpo));
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  listar(@Query() q: Record<string, Texto>): Promise<AcessoDiarioDTO[]> {
    return this.repo.listar(parseDiasAcessos(q));
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './setup.js';

/**
 * Entrada da API como função serverless da Vercel (ADR 0007).
 *
 * A aplicação Nest é criada uma vez por instância e reaproveitada entre requisições. Tiles e
 * Swagger ficam de fora: os tiles são servidos como arquivos estáticos pela CDN.
 */
type Tratador = (req: IncomingMessage, res: ServerResponse) => void;

let pronto: Promise<Tratador> | undefined;

async function iniciar(): Promise<Tratador> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] });
  configurarApp(app, { servirTiles: false, documentacao: false });
  await app.init();
  return app.getHttpAdapter().getInstance() as Tratador;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  pronto ??= iniciar().catch((erro: unknown) => {
    pronto = undefined; // tenta de novo na próxima requisição
    throw erro;
  });
  const tratar = await pronto;
  tratar(req, res);
}

import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** data/processed/tiles na raiz do repositório (apps/api/{src,dist} -> ../../../data). */
export const TILES_DIR_PADRAO = resolve(import.meta.dirname, '../../../data/processed/tiles');

export interface OpcoesApp {
  tilesDir?: string;
  corsOrigin?: string;
}

/** Configuração HTTP comum a main.ts e aos testes e2e. */
export function configurarApp(app: NestExpressApplication, opcoes: OpcoesApp = {}) {
  const tilesDir = opcoes.tilesDir ?? process.env.TILES_DIR ?? TILES_DIR_PADRAO;
  const origens = (opcoes.corsOrigin ?? process.env.CORS_ORIGIN ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: origens,
    methods: ['GET', 'HEAD', 'OPTIONS'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'ETag'],
  });

  // Tiles PMTiles: express.static (send) já responde a HTTP Range (206).
  app.useStaticAssets(resolve(tilesDir), {
    prefix: '/tiles',
    etag: true,
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=3600'),
  });

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('WebGIS SUS-MG')
      .setDescription('API dos estabelecimentos de saúde do SUS em Minas Gerais')
      .setVersion('0.1')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, doc);
  return app;
}


import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Proxy de /api e /tiles para a API (`API_URL`), para que o site rode numa única origem.
 * Repassa método, Range, validadores condicionais e o corpo do POST /api/acessos (ADR 0009); devolve
 * status e cabeçalhos de cache/intervalo e transmite o corpo em stream (os PMTiles têm centenas de MB).
 */
const API_URL = (process.env['API_URL'] || 'http://localhost:3000').replace(/\/+$/, '');
const CABECALHOS_PEDIDO = ['accept', 'content-type', 'range', 'if-range', 'if-none-match', 'if-modified-since', 'user-agent'];
const CABECALHOS_RESPOSTA = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
  'cache-control',
  'vary',
];

async function repassar(req: express.Request, res: express.Response): Promise<void> {
  const cabecalhos: Record<string, string> = { 'accept-encoding': 'identity' };
  for (const nome of CABECALHOS_PEDIDO) {
    const v = req.headers[nome];
    if (typeof v === 'string') cabecalhos[nome] = v;
  }
  const abortar = new AbortController();
  res.on('close', () => abortar.abort());
  try {
    const resposta = await fetch(API_URL + req.originalUrl, {
      method: req.method,
      headers: cabecalhos,
      signal: abortar.signal,
      ...(req.method === 'POST' ? { body: Readable.toWeb(req) as ReadableStream, duplex: 'half' as const } : {}),
    });
    res.status(resposta.status);
    for (const nome of CABECALHOS_RESPOSTA) {
      const v = resposta.headers.get(nome);
      if (v !== null) res.setHeader(nome, v);
    }
    if (!resposta.body || req.method === 'HEAD') {
      res.end();
      return;
    }
    await pipeline(Readable.fromWeb(resposta.body as import('node:stream/web').ReadableStream), res);
  } catch (erro) {
    if (abortar.signal.aborted) return; // o cliente desistiu
    if (!res.headersSent) res.status(502).json({ statusCode: 502, message: 'API indisponível' });
    else res.destroy(erro as Error);
  }
}

/** Único POST da API: a contagem anônima de acessos. */
const POST_PERMITIDO = '/api/acessos';

app.use(['/api', '/tiles'], (req, res, next) => {
  const post = req.method === 'POST' && req.originalUrl.split('?')[0] === POST_PERMITIDO;
  if (req.method !== 'GET' && req.method !== 'HEAD' && !post) return next();
  void repassar(req, res);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, caminho) => {
      // Arquivos sem hash no nome: o service worker precisa revalidar sempre para detectar versões novas.
      if (/(ngsw\.json|ngsw-worker\.js|safety-worker\.js|worker-basic\.min\.js|manifest\.webmanifest)$/.test(caminho)) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.(png|ico|svg)$/.test(caminho) && !/-[A-Z0-9]{8}\./.test(caminho)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

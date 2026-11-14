#!/usr/bin/env node
/**
 * Monta `.vercel/output` (Build Output API v3) a partir dos builds locais. Ver ADR 0007.
 *
 *   static/            site Angular (browser) + tiles PMTiles em /tiles (servidos pela CDN, com Range)
 *   functions/api.func Nest empacotado num único arquivo (esbuild) -> /api/*
 *   functions/ssr.func servidor SSR do Angular -> demais rotas (metas Open Graph por página)
 *
 * Os tiles vêm de data/processed/tiles (gerados pelo ETL, não versionados), por isso o deploy é
 * feito a partir desta máquina (`pnpm deploy:vercel`) e não por build no Git da Vercel.
 *
 * Uso: node infra/vercel/build.mjs [--sem-build]
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const RAIZ = resolve(import.meta.dirname, '../..');
const SAIDA = join(RAIZ, '.vercel/output');
const WEB_DIST = join(RAIZ, 'apps/web/dist/web');
const API_DIST = join(RAIZ, 'apps/api/dist');
const TILES = join(RAIZ, 'data/processed/tiles');
const TILES_ESPERADOS = ['municipios.pmtiles', 'regioes.pmtiles', 'setores.pmtiles'];
const REGIAO = process.env.VERCEL_REGIAO ?? 'gru1'; // São Paulo, perto do Neon sa-east-1
const RUNTIME = 'nodejs22.x';

function passo(msg) {
  console.log(`\n▸ ${msg}`);
}

function json(caminho, dado) {
  writeFileSync(caminho, JSON.stringify(dado, null, 2) + '\n');
}

// 1. builds -----------------------------------------------------------------------------------------
if (!process.argv.includes('--sem-build')) {
  passo('build da API e do site');
  execFileSync('pnpm', ['--filter', 'api', 'build'], { cwd: RAIZ, stdio: 'inherit' });
  execFileSync('pnpm', ['--filter', 'web', 'build'], { cwd: RAIZ, stdio: 'inherit' });
}

for (const t of TILES_ESPERADOS) {
  if (!existsSync(join(TILES, t))) {
    console.error(`Falta ${join(TILES, t)}. Rode o ETL (pipelines/run.sh etl/carga.py AAAAMM) antes.`);
    process.exit(1);
  }
}

rmSync(SAIDA, { recursive: true, force: true });
mkdirSync(SAIDA, { recursive: true });

// 2. estáticos --------------------------------------------------------------------------------------
passo('arquivos estáticos (site + tiles)');
const estatico = join(SAIDA, 'static');
cpSync(join(WEB_DIST, 'browser'), estatico, { recursive: true });
mkdirSync(join(estatico, 'tiles'));
for (const t of TILES_ESPERADOS) cpSync(join(TILES, t), join(estatico, 'tiles', t));

// 3. função da API ----------------------------------------------------------------------------------
passo('função da API (esbuild)');
const funcApi = join(SAIDA, 'functions/api.func');
mkdirSync(funcApi, { recursive: true });
await build({
  // Empacota a saída do tsc (que já traz os metadados dos decorators), não o TS.
  entryPoints: [join(API_DIST, 'vercel.js')],
  outfile: join(funcApi, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  minify: false,
  sourcemap: false,
  logLevel: 'warning',
  // Dependências opcionais que o Nest/pg tentam carregar com require() dentro de try/catch.
  external: [
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    'class-transformer',
    'class-transformer/*',
    'class-validator',
    '@fastify/static',
    'pg-native',
  ],
  // Pacotes CommonJS dentro de um bundle ESM ainda usam require/__dirname.
  banner: {
    js: [
      "import { createRequire as __criarRequire } from 'node:module';",
      "import { fileURLToPath as __paraCaminho } from 'node:url';",
      "import { dirname as __diretorio } from 'node:path';",
      'const require = __criarRequire(import.meta.url);',
      'const __filename = __paraCaminho(import.meta.url);',
      'const __dirname = __diretorio(__filename);',
    ].join('\n'),
  },
});
json(join(funcApi, '.vc-config.json'), {
  runtime: RUNTIME,
  handler: 'index.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  regions: [REGIAO],
  environment: { NODE_ENV: 'production', PG_POOL_MAX: '3' },
});

// 4. função do SSR ----------------------------------------------------------------------------------
passo('função do SSR (Angular)');
const funcSsr = join(SAIDA, 'functions/ssr.func');
cpSync(join(WEB_DIST, 'server'), funcSsr, { recursive: true });
writeFileSync(
  join(funcSsr, 'vercel.mjs'),
  `/**
 * Adaptador do SSR do Angular para a Vercel (gerado por infra/vercel/build.mjs).
 * API_URL e PUBLIC_URL são lidas quando server.mjs é carregado; por isso o import é adiado até a
 * primeira requisição, cuja origem vira o padrão (o SSR chama /api na mesma implantação).
 */
let tratar;
export default async function handler(req, res) {
  if (!tratar) {
    const host = req.headers['x-forwarded-host'] ?? req.headers.host;
    const origem = 'https://' + String(host).split(',')[0].trim();
    const producao = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    process.env.API_URL ||= origem;
    process.env.PUBLIC_URL ||= producao ? 'https://' + producao : origem;
    // Proteção do Angular contra SSRF: só aceita os hosts da própria implantação.
    // Domínio próprio: acrescente-o em NG_ALLOWED_HOSTS nas variáveis do projeto na Vercel.
    process.env.NG_ALLOWED_HOSTS = [
      process.env.NG_ALLOWED_HOSTS,
      producao,
      process.env.VERCEL_URL,
      process.env.VERCEL_BRANCH_URL,
      '*.vercel.app',
    ]
      .filter(Boolean)
      .join(',');
    ({ reqHandler: tratar } = await import('./server.mjs'));
  }
  return tratar(req, res);
}
`,
);
json(join(funcSsr, '.vc-config.json'), {
  runtime: RUNTIME,
  handler: 'vercel.mjs',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  regions: [REGIAO],
  environment: { NODE_ENV: 'production' },
});

// 5. rotas ------------------------------------------------------------------------------------------
passo('config.json');
const SEM_CACHE = String.raw`^/(ngsw\.json|ngsw-worker\.js|safety-worker\.js|worker-basic\.min\.js|manifest\.webmanifest)$`;
json(join(SAIDA, 'config.json'), {
  version: 3,
  routes: [
    // Cabeçalhos (continue: segue para as regras seguintes)
    { src: String.raw`^/tiles/.+\.pmtiles$`, headers: { 'Cache-Control': 'public, max-age=3600' }, continue: true },
    { src: SEM_CACHE, headers: { 'Cache-Control': 'no-cache' }, continue: true },
    {
      src: String.raw`^/[^/]+-[A-Z0-9]{8}\.(js|mjs|css)$`,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      continue: true,
    },
    { handle: 'filesystem' },
    { src: '^/api(/.*)?$', dest: '/api' },
    { src: String.raw`^/tiles/.*$`, status: 404 },
    { src: '^/.*$', dest: '/ssr' },
  ],
});

// resumo --------------------------------------------------------------------------------------------
function tamanho(dir) {
  let total = 0;
  for (const nome of readdirSync(dir, { recursive: true })) {
    const s = statSync(join(dir, nome));
    if (s.isFile()) total += s.size;
  }
  return (total / 1024 / 1024).toFixed(1) + ' MB';
}
passo('pronto: .vercel/output');
console.log(`  static     ${tamanho(estatico)}`);
console.log(`  api.func   ${tamanho(funcApi)}`);
console.log(`  ssr.func   ${tamanho(funcSsr)}`);

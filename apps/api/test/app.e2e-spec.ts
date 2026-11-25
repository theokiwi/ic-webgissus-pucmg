import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/setup.js';
import { TEST_DATABASE_URL } from './banco.js';

let app: NestExpressApplication;
let tilesDir: string;
let valhalla: Server;
let valhallaUrl: string;
let ultimoCorpo: any;
let valhallaStatus = 200;

// polyline6 de [(-19.95,-43.95), (-19.94,-43.94)] (lat,lon)
const SHAPE = '~ys`e@~ynyrA_pR_pR';

async function subir(env: Record<string, string | undefined>) {
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const a = mod.createNestApplication<NestExpressApplication>();
  configurarApp(a, { tilesDir, corsOrigin: 'http://localhost:4200' });
  await a.init();
  return a;
}

beforeAll(async () => {
  tilesDir = await mkdtemp(join(tmpdir(), 'tiles-'));
  await writeFile(join(tilesDir, 'mg.pmtiles'), '0123456789abcdefghij');

  valhalla = createServer((req, res) => {
    let corpo = '';
    req.on('data', (c) => (corpo += c));
    req.on('end', () => {
      ultimoCorpo = { url: req.url, corpo: JSON.parse(corpo) };
      res.statusCode = valhallaStatus;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          trip: {
            summary: { length: 1.234, time: 120.4 },
            legs: [
              {
                shape: SHAPE,
                maneuvers: [
                  { instruction: 'Siga em frente.', length: 1.0, time: 100 },
                  { instruction: 'Você chegou.', length: 0.234, time: 20.4 },
                ],
              },
            ],
          },
        }),
      );
    });
  });
  await new Promise<void>((r) => valhalla.listen(0, '127.0.0.1', r));
  valhallaUrl = `http://127.0.0.1:${(valhalla.address() as AddressInfo).port}`;

  app = await subir({ DATABASE_URL: TEST_DATABASE_URL, VALHALLA_URL: valhallaUrl });
});

afterAll(async () => {
  await app.close();
  await new Promise((r) => valhalla.close(r));
  await rm(tilesDir, { recursive: true, force: true });
});

const http = () => request(app.getHttpServer());

describe('health e meta', () => {
  it('GET /api/health', async () => {
    const r = await http().get('/api/health').expect(200);
    expect(r.body).toEqual({ status: 'ok' });
  });

  it('GET /api/meta usa a última carga e agrega', async () => {
    const r = await http().get('/api/meta').expect(200);
    expect(r.body.competencia).toBe('202609');
    expect(r.body.atualizadoEm).toBe('2026-10-01T13:00:00.000Z');
    expect(r.body.totais).toEqual({ municipios: 3, estabelecimentos: 10, populacao: 15000 });
    expect(r.body.porCategoria.atencao_basica).toBe(2);
    expect(r.body.porCategoria.hospital).toBe(1);
    expect(Object.keys(r.body.porCategoria)).toHaveLength(10);
    expect(typeof r.body.rotas).toBe('boolean');
  });
});

describe('regioes', () => {
  it('GET /api/regioes traz bbox', async () => {
    const r = await http().get('/api/regioes').expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ cd: '3101', nome: 'Macro Teste', bbox: [-44, -20, -42.9, -19.9] });
    expect(r.body[0].regioes[0]).toMatchObject({ cd: '31001', bbox: [-44, -20, -42.9, -19.9] });
  });
});

describe('municipios', () => {
  it('lista com contagens por categoria', async () => {
    const r = await http().get('/api/municipios').expect(200);
    expect(r.body.map((m: any) => m.nome)).toEqual(['Alfa', 'Beta', 'Gama']);
    const alfa = r.body[0];
    expect(alfa.totalEstabelecimentos).toBe(5);
    expect(alfa.porCategoria).toEqual({ atencao_basica: 2, hospital: 1, laboratorio: 1, hemocentro: 1 });
  });

  it('filtra por macro e regiao', async () => {
    expect((await http().get('/api/municipios?macro=3101&regiao=31001').expect(200)).body).toHaveLength(3);
    expect((await http().get('/api/municipios?macro=9999').expect(200)).body).toHaveLength(0);
    await http().get('/api/municipios?macro=abc').expect(400);
  });

  it('detalhe com bbox e indicador por 10 mil', async () => {
    const r = await http().get('/api/municipios/3100001').expect(200);
    expect(r.body).toMatchObject({
      cd: '3100001',
      nomeRegiao: 'Região Teste',
      nomeMacro: 'Macro Teste',
      bbox: [-44, -20, -43.9, -19.9],
      totalEstabelecimentos: 5,
      estabelecimentosPor10mil: 5,
    });
    const gama = await http().get('/api/municipios/3100003').expect(200);
    expect(gama.body.estabelecimentosPor10mil).toBeNull();
    expect(gama.body.populacao).toBeNull();
  });

  it('404 e 400', async () => {
    await http().get('/api/municipios/3199999').expect(404);
    await http().get('/api/municipios/123').expect(400);
    await http().get('/api/municipios/abcdefg').expect(400);
  });

  it('GeoJSON de estabelecimentos, com filtro de categoria', async () => {
    const r = await http().get('/api/municipios/3100001/estabelecimentos').expect(200);
    expect(r.body.type).toBe('FeatureCollection');
    expect(r.body.features).toHaveLength(5);
    const f = r.body.features.find((x: any) => x.properties.cnes === '1000001');
    expect(f.geometry).toEqual({ type: 'Point', coordinates: [-43.95, -19.95] });
    expect(f.properties).toEqual({
      cnes: '1000001',
      nome: 'UBS Centro Saúde',
      categoria: 'atencao_basica',
      bairro: 'Centro',
      sempreAberto: false,
      coordOk: true,
    });
    const hosp = await http().get('/api/municipios/3100001/estabelecimentos?categoria=hospital').expect(200);
    expect(hosp.body.features).toHaveLength(1);
    await http().get('/api/municipios/3100001/estabelecimentos?categoria=xyz').expect(400);
    await http().get('/api/municipios/3199999/estabelecimentos').expect(404);
  });
});

describe('estabelecimentos', () => {
  const base = '/api/estabelecimentos/proximos?lat=-19.95&lon=-43.95';

  it('proximos ordena por distância e exclui coord_ok=false', async () => {
    const r = await http().get(`${base}&raioKm=5`).expect(200);
    const cnes = r.body.map((x: any) => x.cnes);
    expect(cnes).toEqual(['1000001', '1000002', '1000004', '1000008']);
    expect(cnes).not.toContain('1000009');
    const d = r.body.map((x: any) => x.distanciaM);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(d[0]).toBe(0);
    expect(r.body[0]).toMatchObject({ municipio: 'Alfa', lon: -43.95, lat: -19.95, coordOk: true });
    expect(r.body[0].horarios).toEqual([
      { dia: 1, abre: '07:00', fecha: '11:00' },
      { dia: 1, abre: '13:00', fecha: '17:00' },
      { dia: 2, abre: '07:00', fecha: '17:00' },
    ]);
    expect(r.body[1].horarios).toEqual([]);
  });

  it('proximos respeita raio, limite e categoria', async () => {
    expect((await http().get(`${base}&raioKm=1`).expect(200)).body.map((x: any) => x.cnes)).toEqual(['1000001']);
    expect((await http().get(`${base}&limite=2`).expect(200)).body).toHaveLength(2);
    const c = await http().get(`${base}&categoria=hospital`).expect(200);
    expect(c.body.map((x: any) => x.cnes)).toEqual(['1000002']);
  });

  it('proximos valida parâmetros', async () => {
    await http().get('/api/estabelecimentos/proximos?lat=-19.95').expect(400);
    await http().get('/api/estabelecimentos/proximos?lat=10&lon=-43.95').expect(400);
    await http().get('/api/estabelecimentos/proximos?lat=-19.95&lon=-80').expect(400);
    await http().get(`${base}&limite=51`).expect(400);
    await http().get(`${base}&raioKm=101`).expect(400);
    await http().get(`${base}&categoria=xyz`).expect(400);
  });

  it('busca ignora acento e caixa', async () => {
    const r = await http().get('/api/estabelecimentos/busca?q=saude').expect(200);
    const cnes = r.body.map((x: any) => x.cnes).sort();
    expect(cnes).toEqual(['1000001', '1000010']);
    expect(r.body[0]).toEqual(
      expect.objectContaining({ municipio: expect.any(String), categoria: expect.any(String) }),
    );
    const r2 = await http().get('/api/estabelecimentos/busca?q=LABORATORIO&limite=1').expect(200);
    expect(r2.body).toHaveLength(1);
    expect(r2.body[0].cnes).toBe('1000004');
  });

  it('busca exige q com 3+ caracteres', async () => {
    await http().get('/api/estabelecimentos/busca?q=sa').expect(400);
    await http().get('/api/estabelecimentos/busca').expect(400);
    expect((await http().get('/api/estabelecimentos/busca?q=%25%25%25').expect(200)).body).toEqual([]);
  });

  it('detalhe completo', async () => {
    const r = await http().get('/api/estabelecimentos/1000001').expect(200);
    expect(r.body).toMatchObject({
      cnes: '1000001',
      codigoUnidade: '3100001000001',
      nome: 'UBS Centro Saúde',
      razaoSocial: 'Prefeitura de Alfa',
      categoria: 'atencao_basica',
      tipoUnidade: { codigo: 2 },
      municipio: { cd: '3100001', nome: 'Alfa' },
      endereco: { logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro', cep: '35000000' },
      natureza: 'publica',
      sempreAberto: false,
      turno: 'Manhã e tarde',
      coordOk: true,
      atualizadoEm: '2026-08-15',
      lon: -43.95,
      lat: -19.95,
      competencia: '202609',
    });
    expect(r.body.horarios).toHaveLength(3);
    expect(r.body.servicos).toEqual([
      { servico: 'Serviço de atenção à saúde bucal', classificacao: 'Odontologia', sus: true },
    ]);
    expect(r.body.atendimentos).toEqual([{ atendimento: 'AMBULATORIAL', sus: true }]);
    const h = await http().get('/api/estabelecimentos/1000002').expect(200);
    expect(h.body.atendimentos).toHaveLength(3);
    expect(h.body.sempreAberto).toBe(true);
  });

  it('404 e 400 no detalhe', async () => {
    await http().get('/api/estabelecimentos/9999999').expect(404);
    await http().get('/api/estabelecimentos/12').expect(400);
  });
});

describe('pesquisa por tipo e critério do município', () => {
  const url = (q: string) => `/api/estabelecimentos/pesquisa?${q}`;
  const cnes = (r: any) => r.body.features.map((f: any) => f.properties.cnes);

  it('GET /api/estabelecimentos/tipos conta por tipo com descrição', async () => {
    const r = await http().get('/api/estabelecimentos/tipos').expect(200);
    expect(r.body).toContainEqual({ codigo: 2, descricao: 'Centro de saúde/Unidade básica', categoria: 'atencao_basica', total: 2 });
    expect(r.body).toHaveLength(9);
    const d = r.body.map((t: any) => t.descricao);
    expect(d).toEqual([...d].sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')));
  });

  it('sem faixa traz todo o tipo, com o valor do critério e propriedades do ponto', async () => {
    const r = await http().get(url('tipo=2&criterio=densidade')).expect(200);
    expect(r.body.type).toBe('FeatureCollection');
    expect(cnes(r)).toEqual(['1000001', '1000009']);
    expect(r.body.features[0]).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-43.95, -19.95] },
      properties: {
        cnes: '1000001', nome: 'UBS Centro Saúde', categoria: 'atencao_basica', natureza: 'publica', bairro: 'Centro',
        sempreAberto: false, coordOk: true, tipoUnidade: 2, cdMunicipio: '3100001', municipio: 'Alfa', valor: 82.99,
      },
    });
  });

  it('mínimo inclusivo e máximo exclusivo', async () => {
    expect(cnes(await http().get(url('tipo=2&criterio=densidade&min=82.99')).expect(200))).toHaveLength(2);
    expect(cnes(await http().get(url('tipo=2&criterio=densidade&max=82.99')).expect(200))).toEqual([]);
    expect(cnes(await http().get(url('tipo=70&criterio=densidade&min=50&max=60')).expect(200))).toEqual(['1000005']);
  });

  it('município sem dado só entra quando não há limite', async () => {
    const sem = await http().get(url('tipo=43&criterio=densidade')).expect(200);
    expect(sem.body.features[0].properties).toMatchObject({ cnes: '1000006', valor: null });
    expect(cnes(await http().get(url('tipo=43&criterio=densidade&min=0')).expect(200))).toEqual([]);
    expect(cnes(await http().get(url('tipo=43&criterio=por10mil&max=1000')).expect(200))).toEqual([]);
  });

  it('calcula total e estabelecimentos por 10 mil do município', async () => {
    const tot = await http().get(url('tipo=5&criterio=total')).expect(200);
    expect(tot.body.features[0].properties.valor).toBe(5);
    const p10 = await http().get(url('tipo=73&criterio=por10mil&min=5&max=7')).expect(200);
    expect(p10.body.features[0].properties).toMatchObject({ municipio: 'Beta', valor: 6 });
    const pop = await http().get(url('tipo=73&criterio=populacao&min=5000')).expect(200);
    expect(pop.body.features[0].properties.valor).toBe(5000);
  });

  it('respeita o recorte e valida os parâmetros', async () => {
    expect(cnes(await http().get(url('tipo=2&criterio=densidade&macro=3101&regiao=31001')).expect(200))).toHaveLength(2);
    expect(cnes(await http().get(url('tipo=2&criterio=densidade&macro=9999')).expect(200))).toEqual([]);
    await http().get(url('criterio=densidade')).expect(400);
    await http().get(url('tipo=2')).expect(400);
    await http().get(url('tipo=2&criterio=xyz')).expect(400);
    await http().get(url('tipo=2&criterio=densidade&min=5&max=1')).expect(400);
  });
});

describe('rota', () => {
  const q = '/api/rota?de=-19.95,-43.95&para=-19.94,-43.94';

  it('proxy para o Valhalla com conversão', async () => {
    const r = await http().get(`${q}&modo=pedestre`).expect(200);
    expect(ultimoCorpo.url).toBe('/route');
    expect(ultimoCorpo.corpo).toEqual({
      locations: [
        { lat: -19.95, lon: -43.95 },
        { lat: -19.94, lon: -43.94 },
      ],
      costing: 'pedestrian',
      directions_options: { language: 'pt-BR', units: 'kilometers' },
    });
    expect(r.body).toEqual({
      modo: 'pedestre',
      distanciaM: 1234,
      duracaoS: 120,
      geometria: {
        type: 'LineString',
        coordinates: [
          [-43.95, -19.95],
          [-43.94, -19.94],
        ],
      },
      passos: [
        { instrucao: 'Siga em frente.', distanciaM: 1000, duracaoS: 100 },
        { instrucao: 'Você chegou.', distanciaM: 234, duracaoS: 20 },
      ],
    });
  });

  it('modo padrão auto; validações 400', async () => {
    await http().get(q).expect(200);
    expect(ultimoCorpo.corpo.costing).toBe('auto');
    await http().get(`${q}&modo=foguete`).expect(400);
    await http().get('/api/rota?de=-19.95,-43.95').expect(400);
    await http().get('/api/rota?de=abc&para=-19.94,-43.94').expect(400);
    await http().get('/api/rota?de=10,-43.95&para=-19.94,-43.94').expect(400);
  });

  it('503 quando o Valhalla falha', async () => {
    valhallaStatus = 500;
    try {
      const r = await http().get(q).expect(503);
      expect(r.body.message).toMatch(/rotas/i);
    } finally {
      valhallaStatus = 200;
    }
  });

  it('503 sem VALHALLA_URL', async () => {
    const sem = await subir({ DATABASE_URL: TEST_DATABASE_URL, VALHALLA_URL: undefined });
    try {
      const r = await request(sem.getHttpServer()).get(q).expect(503);
      expect(r.body.message).toMatch(/VALHALLA_URL/);
    } finally {
      await sem.close();
      process.env.VALHALLA_URL = valhallaUrl;
    }
  });
});

describe('acessos', () => {
  const ig = { origem: 'instagram', meio: 'social', campanha: 'divulgacao' };

  it('POST soma por dia, origem, meio e campanha; GET lista os totais', async () => {
    await http().post('/api/acessos').send(ig).expect(204);
    await http().post('/api/acessos').send(ig).expect(204);
    await http().post('/api/acessos').send({ origem: 'cartaz', meio: 'impresso', campanha: 'divulgacao' }).expect(204);
    const r = await http().get('/api/acessos?dias=1').expect(200);
    expect(r.headers['cache-control']).toBe('no-store');
    const sem = r.body.map(({ dia, ...resto }: any) => {
      expect(dia).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      return resto;
    });
    expect(sem).toEqual([
      { ...ig, n: 2 },
      { origem: 'cartaz', meio: 'impresso', campanha: 'divulgacao', n: 1 },
    ]);
  });

  it('valida o corpo e o período', async () => {
    await http().post('/api/acessos').send({ ...ig, origem: 'Instagram!' }).expect(400);
    await http().post('/api/acessos').send({ origem: 'x' }).expect(400);
    await http().get('/api/acessos?dias=400').expect(400);
  });
});

describe('tiles, CORS e docs', () => {
  it('serve arquivo inteiro com Cache-Control e Accept-Ranges', async () => {
    const r = await http().get('/tiles/mg.pmtiles').expect(200);
    expect(r.headers['accept-ranges']).toBe('bytes');
    expect(r.headers['cache-control']).toMatch(/max-age/);
    expect(r.body.toString()).toBe('0123456789abcdefghij');
  });

  it('responde 206 a Range', async () => {
    const r = await http().get('/tiles/mg.pmtiles').set('Range', 'bytes=5-9').expect(206);
    expect(r.headers['content-range']).toBe('bytes 5-9/20');
    expect(r.body.toString()).toBe('56789');
    await http().get('/tiles/nao-existe.pmtiles').expect(404);
  });

  it('CORS libera localhost:4200', async () => {
    const r = await http().get('/api/health').set('Origin', 'http://localhost:4200').expect(200);
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    const o = await http().get('/api/health').set('Origin', 'http://evil.example').expect(200);
    expect(o.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('Swagger em /api/docs', async () => {
    await http().get('/api/docs-json').expect(200);
    await http().get('/api/docs').expect(200);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from '../app.routes';
import { EstadoService, MSG_ROTA_INDISPONIVEL } from './estado.service';

describe('EstadoService', () => {
  let estado: EstadoService;
  let router: Router;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    estado = TestBed.inject(EstadoService);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  it('a rota do estado segue a URL', async () => {
    await router.navigateByUrl('/municipio/3106200?cat=hospital&q=casa');
    expect(estado.rota()).toMatchObject({ visao: 'municipio', cd: '3106200', cat: 'hospital', q: 'casa' });
  });

  it('selecionar município navega para /municipio/:cd', async () => {
    estado.selecionarMunicipio('3106200');
    await new Promise((r) => setTimeout(r, 20));
    expect(router.url).toBe('/municipio/3106200');
  });

  it('limpar volta para a raiz mantendo o tema', async () => {
    await router.navigateByUrl('/municipio/3106200?tema=total&cat=hospital');
    estado.limpar();
    await new Promise((r) => setTimeout(r, 20));
    expect(router.url).toBe('/?tema=total');
  });

  it('carrega município e pontos quando a rota é de município', async () => {
    await router.navigateByUrl('/municipio/3106200');
    TestBed.tick();
    await new Promise((r) => setTimeout(r));
    http.expectOne('/api/municipios/3106200').flush({ cd: '3106200', nome: 'BH', bbox: [0, 0, 1, 1] });
    http.expectOne('/api/municipios/3106200/estabelecimentos').flush({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { cnes: '1', nome: 'UBS Centro', categoria: 'atencao_basica', bairro: 'Centro', sempreAberto: false, coordOk: true } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { cnes: '2', nome: 'Hospital São José', categoria: 'hospital', bairro: 'Funcionários', sempreAberto: true, coordOk: true } },
      ],
    });
    await new Promise((r) => setTimeout(r));
    expect(estado.pontosVisiveis().length).toBe(2);
    await router.navigateByUrl('/municipio/3106200?cat=hospital');
    expect(estado.pontosVisiveis().map((f) => f.properties.cnes)).toEqual(['2']);
    await router.navigateByUrl('/municipio/3106200?q=sao%20jose');
    expect(estado.pontosVisiveis().map((f) => f.properties.cnes)).toEqual(['2']);
    expect(estado.contagemPorCategoria()).toEqual({ hospital: 1 });
  });

  it('/perto com ponto consulta os próximos com categoria e raio da URL', async () => {
    await router.navigateByUrl('/perto?lat=-19.9191&lon=-43.9386&cat=urgencia&raio=100');
    TestBed.tick();
    await new Promise((r) => setTimeout(r));
    const req = http.expectOne((r) => r.url === '/api/estabelecimentos/proximos');
    expect(req.request.params.get('categoria')).toBe('urgencia');
    expect(req.request.params.get('raioKm')).toBe('100');
    expect(req.request.params.get('limite')).toBe('20');
    req.flush([]);
    await new Promise((r) => setTimeout(r));
    expect(estado.perto.dado()).toEqual([]);
  });

  it('irParaPerto arredonda o ponto na URL e ampliarRaio muda para 100 km', async () => {
    estado.irParaPerto({ lat: -19.91912345, lon: -43.93861234 });
    await new Promise((r) => setTimeout(r, 20));
    expect(router.url).toBe('/perto?lat=-19.9191&lon=-43.9386');
    estado.ampliarRaio();
    await new Promise((r) => setTimeout(r, 20));
    expect(router.url).toBe('/perto?lat=-19.9191&lon=-43.9386&raio=100');
  });

  it('comoChegar usa a posição conhecida e põe modo e origem na URL da ficha', async () => {
    await router.navigateByUrl('/estabelecimento/2695324');
    estado.localizacao.posicao.set({ lat: -19.91919, lon: -43.93861 });
    await estado.comoChegar('pedestre');
    await new Promise((r) => setTimeout(r, 20));
    expect(router.url).toBe('/estabelecimento/2695324?rota=pedestre&de=-19.9192,-43.9386');
    estado.limparRota();
    await new Promise((r) => setTimeout(r, 20));
    expect(router.url).toBe('/estabelecimento/2695324');
  });

  it('rota com 503 vira mensagem de indisponibilidade', async () => {
    await router.navigateByUrl('/estabelecimento/2695324?rota=auto&de=-19.9191,-43.9386');
    TestBed.tick();
    await new Promise((r) => setTimeout(r));
    http.expectOne('/api/estabelecimentos/2695324').flush({ cnes: '2695324', lat: -19.93, lon: -43.95, municipio: { cd: '3106200', nome: 'BH' } });
    TestBed.tick();
    await new Promise((r) => setTimeout(r));
    http.match((r) => r.url.startsWith('/api/municipios'));
    const req = http.expectOne((r) => r.url === '/api/rota');
    expect(req.request.params.get('para')).toBe('-19.93,-43.95');
    req.flush({ message: 'x' }, { status: 503, statusText: 'Service Unavailable' });
    await new Promise((r) => setTimeout(r));
    expect(estado.rotaCalculada.erro()).toBe(MSG_ROTA_INDISPONIVEL);
  });
});

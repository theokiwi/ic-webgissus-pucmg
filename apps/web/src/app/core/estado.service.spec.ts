import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from '../app.routes';
import { EstadoService } from './estado.service';

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
});

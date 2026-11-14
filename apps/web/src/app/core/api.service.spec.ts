import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('GET /api/meta', () => {
    let r: unknown;
    api.meta().subscribe((v) => (r = v));
    const req = http.expectOne('/api/meta');
    expect(req.request.method).toBe('GET');
    req.flush({ competencia: '202609' });
    expect(r).toEqual({ competencia: '202609' });
  });

  it('GET /api/regioes', () => {
    api.regioes().subscribe();
    http.expectOne('/api/regioes').flush([]);
  });

  it('GET /api/municipios com e sem filtros', () => {
    api.municipios().subscribe();
    http.expectOne('/api/municipios').flush([]);
    api.municipios({ macro: '3101', regiao: '31001' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/municipios');
    expect(req.request.params.get('macro')).toBe('3101');
    expect(req.request.params.get('regiao')).toBe('31001');
    req.flush([]);
  });

  it('GET município, pontos e ficha', () => {
    api.municipio('3106200').subscribe();
    http.expectOne('/api/municipios/3106200').flush({});
    api.estabelecimentosDoMunicipio('3106200').subscribe();
    http.expectOne('/api/municipios/3106200/estabelecimentos').flush({ type: 'FeatureCollection', features: [] });
    api.estabelecimento('2695324').subscribe();
    http.expectOne('/api/estabelecimentos/2695324').flush({});
  });

  it('GET busca envia q e limite', () => {
    api.busca('upa centro', 5).subscribe();
    const req = http.expectOne((r) => r.url === '/api/estabelecimentos/busca');
    expect(req.request.params.get('q')).toBe('upa centro');
    expect(req.request.params.get('limite')).toBe('5');
    req.flush([]);
  });

  it('GET proximos envia ponto, categoria, limite e raio', () => {
    let n = 0;
    api.proximos(-19.9191, -43.9386, { categoria: 'urgencia', limite: 20, raioKm: 30 }).subscribe((v) => (n = v.length));
    const req = http.expectOne((r) => r.url === '/api/estabelecimentos/proximos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('lat')).toBe('-19.9191');
    expect(req.request.params.get('lon')).toBe('-43.9386');
    expect(req.request.params.get('categoria')).toBe('urgencia');
    expect(req.request.params.get('limite')).toBe('20');
    expect(req.request.params.get('raioKm')).toBe('30');
    req.flush([{ cnes: '1' }]);
    expect(n).toBe(1);
  });

  it('GET proximos usa limite 20 e raio 30 por padrão e omite categoria', () => {
    api.proximos(1, 2).subscribe();
    const req = http.expectOne((r) => r.url === '/api/estabelecimentos/proximos');
    expect(req.request.params.has('categoria')).toBe(false);
    expect(req.request.params.get('limite')).toBe('20');
    expect(req.request.params.get('raioKm')).toBe('30');
    req.flush([]);
  });

  it('GET rota envia de, para e modo', () => {
    api.rota({ lat: -19.9, lon: -43.9 }, { lat: -19.93, lon: -43.95 }, 'pedestre').subscribe();
    const req = http.expectOne((r) => r.url === '/api/rota');
    expect(req.request.params.get('de')).toBe('-19.9,-43.9');
    expect(req.request.params.get('para')).toBe('-19.93,-43.95');
    expect(req.request.params.get('modo')).toBe('pedestre');
    req.flush({});
  });

  it('propaga erro HTTP', () => {
    let status = 0;
    api.meta().subscribe({ error: (e) => (status = e.status) });
    http.expectOne('/api/meta').flush('x', { status: 500, statusText: 'Erro' });
    expect(status).toBe(500);
  });
});

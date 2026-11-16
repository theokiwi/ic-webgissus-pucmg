import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from '../app.routes';
import { AcessosService } from './acessos.service';

describe('AcessosService', () => {
  let router: Router;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AcessosService).iniciar();
  });

  afterEach(() => http.verify());

  it('atalho /cartaz redireciona com utm e conta uma vez a origem', async () => {
    await router.navigateByUrl('/cartaz');
    expect(router.url).toBe('/?utm_source=cartaz&utm_medium=impresso&utm_campaign=divulgacao');
    const req = http.expectOne('/api/acessos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ origem: 'cartaz', meio: 'impresso', campanha: 'divulgacao' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    // Navegações seguintes não contam.
    await router.navigateByUrl('/?utm_source=whatsapp');
    http.expectNone('/api/acessos');
  });

  it('acesso sem utm não envia nada', async () => {
    await router.navigateByUrl('/municipio/3106200');
    http.expectNone('/api/acessos');
  });

  it('recarregar a mesma aba com a mesma origem não conta de novo', async () => {
    sessionStorage.setItem('webgissus:acesso-contado', 'instagram|social|divulgacao');
    await router.navigateByUrl('/insta');
    http.expectNone('/api/acessos');
  });
});

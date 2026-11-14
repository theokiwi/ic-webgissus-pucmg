import { FetchBackend, HttpBackend, type HttpEvent, type HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { URL_API_SERVIDOR } from './ambiente';

/**
 * Backend HTTP só do SSR: prefixa `API_URL` nos caminhos relativos (`/api/...`).
 *
 * Fica no backend, e não num interceptor, de propósito: o HttpTransferCache (interceptor raiz) roda
 * antes do backend e então enxerga a mesma URL relativa que o navegador pede, o que faz as chaves
 * do cache de transferência coincidirem.
 */
@Injectable()
export class ApiServidorBackend implements HttpBackend {
  private readonly fetch = inject(FetchBackend);
  private readonly base = (inject(URL_API_SERVIDOR) ?? '').replace(/\/+$/, '');

  handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return this.fetch.handle(this.base && req.url.startsWith('/') ? req.clone({ url: this.base + req.url }) : req);
  }
}

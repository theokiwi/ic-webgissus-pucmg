import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { HttpBackend } from '@angular/common/http';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { ApiServidorBackend } from './core/api-servidor.backend';
import { URL_API_PADRAO, URL_API_SERVIDOR, URL_PUBLICA, URL_PUBLICA_PADRAO } from './core/ambiente';
import { serverRoutes } from './app.routes.server';

const semBarra = (u: string) => u.replace(/\/+$/, '');
const urlApi = semBarra(process.env['API_URL'] || URL_API_PADRAO);
const urlPublica = semBarra(process.env['PUBLIC_URL'] || URL_PUBLICA_PADRAO);

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Chamadas à API durante o SSR vão direto para API_URL (ApiServidorBackend prefixa).
    { provide: URL_API_SERVIDOR, useValue: urlApi },
    { provide: URL_PUBLICA, useValue: urlPublica },
    { provide: HttpBackend, useClass: ApiServidorBackend },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);

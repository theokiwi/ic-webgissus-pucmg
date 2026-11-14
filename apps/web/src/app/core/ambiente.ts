import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, inject, InjectionToken, PLATFORM_ID } from '@angular/core';

export const URL_PUBLICA_PADRAO = 'http://localhost:4200';
export const URL_API_PADRAO = 'http://localhost:3000';

/**
 * Origem pública do site (sem barra final), usada nas URLs absolutas de og:url,
 * og:image e canonical. No servidor vem de `PUBLIC_URL` (ver app.config.server.ts);
 * no navegador é a própria origem.
 */
export const URL_PUBLICA = new InjectionToken<string>('URL_PUBLICA', {
  factory: () =>
    isPlatformBrowser(inject(PLATFORM_ID)) ? inject(DOCUMENT).location.origin : URL_PUBLICA_PADRAO,
});

/** Origem da API acessada pelo servidor SSR (`API_URL`). `null` no navegador, que usa caminhos relativos. */
export const URL_API_SERVIDOR = new InjectionToken<string | null>('URL_API_SERVIDOR', {
  factory: () => null,
});

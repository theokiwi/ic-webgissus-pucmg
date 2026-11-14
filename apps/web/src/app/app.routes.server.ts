import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Páginas estáticas, prerenderizadas no build (o PUBLIC_URL do build vai para og:url/og:image).
  { path: 'sobre', renderMode: RenderMode.Prerender },
  { path: 'privacidade', renderMode: RenderMode.Prerender },
  // Demais rotas por SSR: as metas Open Graph dependem da API e de PUBLIC_URL em tempo de execução.
  { path: '**', renderMode: RenderMode.Server },
];

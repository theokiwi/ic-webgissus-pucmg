import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Só a página inicial é pré-renderizada; as rotas com parâmetro vão por SSR
  // (a fase 6 gera meta tags OG para elas).
  { path: '', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Server },
];

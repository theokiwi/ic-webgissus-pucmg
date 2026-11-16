import { Routes } from '@angular/router';
import { ATALHOS_DIVULGACAO, urlDivulgacao, type AtalhoDivulgacao } from '@webgissus/domain';

/** Atalhos de divulgação (ADR 0009): /insta, /whats e /cartaz levam ao mapa com os utm_* do canal. */
const atalhos: Routes = (Object.keys(ATALHOS_DIVULGACAO) as AtalhoDivulgacao[]).map((a) => ({
  path: a,
  pathMatch: 'full',
  redirectTo: urlDivulgacao(a),
}));

/**
 * As rotas só existem para o Router reconhecer as URLs e manter o histórico;
 * a tela é sempre a mesma (mapa) e lê o estado da URL em core/estado-url.ts.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', children: [] },
  { path: 'macro/:cd', children: [] },
  { path: 'regiao/:cd', children: [] },
  { path: 'municipio/:cd', children: [] },
  { path: 'estabelecimento/:cnes', children: [] },
  { path: 'perto', children: [] },
  ...atalhos,
  {
    path: 'sobre',
    title: 'Sobre o projeto | WebGIS SUS-MG',
    loadComponent: () => import('./features/paginas/sobre.component').then((m) => m.SobreComponent),
  },
  {
    path: 'privacidade',
    title: 'Privacidade | WebGIS SUS-MG',
    loadComponent: () => import('./features/paginas/privacidade.component').then((m) => m.PrivacidadeComponent),
  },
  { path: '**', redirectTo: '' },
];

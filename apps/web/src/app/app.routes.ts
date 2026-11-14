import { Routes } from '@angular/router';

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
  { path: '**', redirectTo: '' },
];

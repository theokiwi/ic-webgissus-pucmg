import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Moldura das páginas editoriais (/sobre, /privacidade): cabeçalho, conteúdo principal e rodapé. */
@Component({
  selector: 'app-pagina',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <header class="topo">
      <div class="in">
        <a class="marca" routerLink="/">WebGIS SUS-MG</a>
        <nav aria-label="Páginas do site">
          <a routerLink="/">Mapa</a>
          <a routerLink="/sobre" routerLinkActive="atual" ariaCurrentWhenActive="page">Sobre</a>
          <a routerLink="/privacidade" routerLinkActive="atual" ariaCurrentWhenActive="page">Privacidade</a>
        </nav>
      </div>
    </header>
    <main id="principal" tabindex="-1">
      <ng-content />
    </main>
    <footer class="rodape">
      <p>
        Projeto de Iniciação Científica (FAPEMIG) · Dados abertos do CNES/DATASUS e do IBGE · © colaboradores do
        OpenStreetMap
      </p>
      <p><a routerLink="/">Voltar ao mapa</a> · <a routerLink="/sobre">Sobre</a> · <a routerLink="/privacidade">Privacidade</a></p>
    </footer>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; background: #f6f8fb; color: var(--texto); }
    .topo { background: var(--primaria); color: #fff; }
    .in { max-width: 1040px; margin: 0 auto; padding: 0 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .marca { color: #fff; font-weight: 800; font-size: 1.125rem; text-decoration: none; min-height: 48px; display: inline-flex; align-items: center; }
    nav { display: flex; gap: 0.25rem; flex-wrap: wrap; }
    nav a { color: #fff; text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; padding: 0 0.75rem; border-radius: 8px; font-weight: 600; font-size: 0.9375rem; }
    nav a:hover, nav a.atual { background: rgba(255, 255, 255, 0.18); }
    nav a.atual { text-decoration: underline; text-underline-offset: 4px; }
    main { display: block; outline: none; }
    .rodape { max-width: 1040px; margin: 0 auto; padding: 1.5rem 1rem 2rem; text-align: center; font-size: 0.8125rem; color: var(--texto-suave); }
    .rodape p { margin: 0.25rem 0; }
    .rodape a { color: var(--primaria); }
  `,
})
export class PaginaComponent {}

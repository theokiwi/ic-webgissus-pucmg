import { ChangeDetectionStrategy, Component, DOCUMENT, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SeoService } from './core/seo.service';
import { MapaComponent } from './features/mapa/mapa.component';

const PAGINAS_ESTATICAS = ['/sobre', '/privacidade'];
const ehEstatica = (url: string) => PAGINAS_ESTATICAS.includes(url.split(/[?#]/)[0].replace(/\/+$/, ''));

@Component({
  imports: [MapaComponent, RouterOutlet],
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  // Parte do caminho da requisição (vale no SSR e na hidratação, antes da navegação inicial terminar).
  protected readonly estatica = signal(ehEstatica(inject(DOCUMENT).location?.pathname ?? '/'));

  constructor() {
    inject(SeoService).iniciar();
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.estatica.set(ehEstatica(e.urlAfterRedirects));
    });
  }
}

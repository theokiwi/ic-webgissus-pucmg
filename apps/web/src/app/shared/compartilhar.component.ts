import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  mensagemCompartilhamento,
  urlCompartilhamento,
  type ContextoCompartilhamento,
  type Rede,
} from '@webgissus/domain';

interface Destino {
  rede: Exclude<Rede, 'nativo' | 'copiar'>;
  rotulo: string;
}

const DESTINOS: readonly Destino[] = [
  { rede: 'whatsapp', rotulo: 'WhatsApp' },
  { rede: 'telegram', rotulo: 'Telegram' },
  { rede: 'x', rotulo: 'X (Twitter)' },
  { rede: 'facebook', rotulo: 'Facebook' },
  { rede: 'linkedin', rotulo: 'LinkedIn' },
  { rede: 'email', rotulo: 'E-mail' },
];

/** Botão "Compartilhar" com Web Share API (quando existe) e links por rede, cada um com mensagem e UTM próprios. */
@Component({
  selector: 'app-compartilhar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn sec abrir"
      [attr.aria-expanded]="aberto()"
      aria-controls="painel-compartilhar"
      (click)="aberto.set(!aberto())"
    >
      Compartilhar
    </button>

    @if (aberto()) {
      <div id="painel-compartilhar" class="painel" role="group" aria-label="Opções de compartilhamento">
        @if (temShare) {
          <button type="button" class="btn nativo" (click)="compartilharNativo()">Compartilhar pelo aparelho</button>
        }
        <ul class="redes">
          @for (d of destinos(); track d.rede) {
            <li>
              <a class="rede" [href]="d.href" target="_blank" rel="noopener noreferrer">
                {{ d.rotulo }}<span class="sr"> (abre em nova aba)</span>
              </a>
            </li>
          }
          <li>
            <button type="button" class="rede" (click)="copiar()">Copiar link</button>
          </li>
        </ul>
        <p class="feedback" role="status" aria-live="polite">{{ feedback() }}</p>
      </div>
    }
  `,
  styles: `
    :host { display: block; margin: 0.5rem 0; }
    .abrir { width: 100%; }
    .painel { margin-top: 0.5rem; padding: 0.75rem; border: 1px solid var(--borda); border-radius: 10px; background: var(--destaque); }
    .nativo { width: 100%; margin-bottom: 0.5rem; }
    .redes { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .rede {
      display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 0 0.5rem;
      border: 1px solid var(--borda-forte); border-radius: 8px; background: var(--superficie); color: var(--texto);
      font: inherit; font-size: 0.875rem; font-weight: 600; text-decoration: none; cursor: pointer;
    }
    .rede:hover { border-color: var(--primaria); color: var(--primaria); }
    .feedback { margin: 0.5rem 0 0; min-height: 1.2em; font-size: 0.8125rem; color: var(--texto-suave); }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class CompartilharComponent {
  readonly contexto = input.required<ContextoCompartilhamento>();

  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);

  protected readonly aberto = signal(false);
  protected readonly feedback = signal('');
  protected readonly temShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  /** URL atual do estado (caminho + query), na origem em que o site está. Recalculada a cada abertura. */
  private urlAtual(): string {
    return this.doc.location.origin + this.router.url;
  }

  protected readonly destinos = computed(() => {
    if (!this.aberto()) return [];
    const ctx = this.contexto();
    const url = this.urlAtual();
    return DESTINOS.map((d) => ({ ...d, href: urlCompartilhamento(d.rede, url, ctx) }));
  });

  protected async compartilharNativo(): Promise<void> {
    const ctx = this.contexto();
    const { texto, assunto } = mensagemCompartilhamento('nativo', ctx);
    try {
      await navigator.share({ title: assunto, text: texto, url: urlCompartilhamento('nativo', this.urlAtual(), ctx) });
    } catch (e) {
      // AbortError = a pessoa fechou a folha de compartilhamento; não é erro.
      if ((e as DOMException)?.name !== 'AbortError') this.feedback.set('Não foi possível abrir o compartilhamento.');
    }
  }

  protected async copiar(): Promise<void> {
    const link = urlCompartilhamento('copiar', this.urlAtual(), this.contexto());
    try {
      await navigator.clipboard.writeText(link);
      this.feedback.set('Link copiado.');
    } catch {
      this.feedback.set('Não foi possível copiar. Copie o endereço na barra do navegador.');
    }
  }
}

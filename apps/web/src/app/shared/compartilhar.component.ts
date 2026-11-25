import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  mensagemCompartilhamento,
  urlCompartilhamento,
  type ContextoCompartilhamento,
  type Rede,
} from '@webgissus/domain';
import { siFacebook, siTelegram, siWhatsapp, siX } from 'simple-icons';

/** Glifo 24×24 em branco: logotipo preenchido (simple-icons, CC0), traços genéricos ou texto. */
type Icone = { preenchido: string } | { tracos: readonly string[] } | { texto: string };

interface Destino {
  rede: Exclude<Rede, 'nativo' | 'copiar'>;
  rotulo: string;
  /** Fundo do botão: tons oficiais escuros o bastante para o glifo branco (contraste ≥ 3:1). */
  cor: string;
  icone: Icone;
}

const DESTINOS: readonly Destino[] = [
  { rede: 'whatsapp', rotulo: 'WhatsApp', cor: '#128C7E', icone: { preenchido: siWhatsapp.path } },
  { rede: 'telegram', rotulo: 'Telegram', cor: '#0088CC', icone: { preenchido: siTelegram.path } },
  { rede: 'x', rotulo: 'X (Twitter)', cor: '#000000', icone: { preenchido: siX.path } },
  { rede: 'facebook', rotulo: 'Facebook', cor: '#0866FF', icone: { preenchido: siFacebook.path } },
  // O LinkedIn saiu do simple-icons a pedido da marca; o "in" em texto é reconhecível o bastante.
  { rede: 'linkedin', rotulo: 'LinkedIn', cor: '#0A66C2', icone: { texto: 'in' } },
  { rede: 'email', rotulo: 'E-mail', cor: '#1565C0', icone: { tracos: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'] } },
];

/** Corrente de elos, para "Copiar link". */
const TRACOS_LINK = [
  'M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5',
  'M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5',
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
              <a
                class="rede"
                [href]="d.href"
                target="_blank"
                rel="noopener noreferrer"
                [style.background]="d.cor"
                [attr.aria-label]="d.rede === 'email' ? d.rotulo : d.rotulo + ' (abre em nova aba)'"
                [title]="d.rotulo"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  @if (temPreenchido(d.icone); as p) {
                    <path [attr.d]="p" fill="#fff" />
                  } @else if (temTexto(d.icone); as t) {
                    <text x="12" y="18" text-anchor="middle" fill="#fff" font-size="17" font-weight="700" font-family="Arial, sans-serif">{{ t }}</text>
                  } @else {
                    @for (tr of tracos(d.icone); track tr) {
                      <path [attr.d]="tr" class="traco" />
                    }
                  }
                </svg>
              </a>
            </li>
          }
          <li>
            <button type="button" class="rede" style="background: #4d5560" aria-label="Copiar link" title="Copiar link" (click)="copiar()">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                @for (tr of tracosLink; track tr) {
                  <path [attr.d]="tr" class="traco" />
                }
              </svg>
            </button>
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
    .redes { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    .rede {
      display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; padding: 0;
      border: 0; border-radius: 50%; cursor: pointer; transition: transform 0.1s;
    }
    .rede svg { width: 24px; height: 24px; }
    .rede .traco { fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .rede:hover { transform: scale(1.08); }
    .rede:focus-visible { outline: 3px solid var(--primaria); outline-offset: 2px; }
    .feedback { margin: 0.5rem 0 0; min-height: 1.2em; font-size: 0.8125rem; color: var(--texto-suave); }
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
  protected readonly tracosLink = TRACOS_LINK;
  protected temPreenchido(i: Icone): string | null {
    return 'preenchido' in i ? i.preenchido : null;
  }
  protected temTexto(i: Icone): string | null {
    return 'texto' in i ? i.texto : null;
  }
  protected tracos(i: Icone): readonly string[] {
    return 'tracos' in i ? i.tracos : [];
  }

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

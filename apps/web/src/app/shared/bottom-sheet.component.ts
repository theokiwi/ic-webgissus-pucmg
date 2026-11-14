import { ChangeDetectionStrategy, Component, ElementRef, inject, input, model, signal } from '@angular/core';

export type TamanhoFolha = 'recolhido' | 'meio' | 'cheio';

const FRACAO: Record<TamanhoFolha, number> = { recolhido: 0, meio: 0.45, cheio: 0.88 };
const ALTURA_RECOLHIDA_PX = 96;
const CICLO: TamanhoFolha[] = ['recolhido', 'meio', 'cheio'];

/**
 * Painel flutuante no desktop; no celular (≤ 600 px) vira uma folha inferior
 * que se arrasta pela alça ou alterna por toque/teclado.
 */
@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="folha"
      [class.direita]="lado() === 'direita'"
      [class.arrastando]="altura() !== null"
      [attr.data-tamanho]="tamanho()"
      [style.height.px]="altura()"
      [attr.aria-label]="rotulo()"
    >
      <button
        type="button"
        class="alca"
        [attr.aria-expanded]="tamanho() !== 'recolhido'"
        [attr.aria-label]="'Painel ' + rotulo() + ': arraste ou toque para expandir e recolher'"
        (pointerdown)="comecar($event)"
        (pointermove)="mover($event)"
        (pointerup)="soltar($event)"
        (pointercancel)="soltar($event)"
        (keydown.enter)="alternar()"
        (keydown.space)="alternar(); $event.preventDefault()"
      >
        <span aria-hidden="true"></span>
      </button>
      <div class="conteudo"><ng-content /></div>
    </section>
  `,
  styles: `
    :host { display: contents; }
    .folha {
      position: absolute; z-index: 5; top: 12px; left: 12px; width: 380px;
      max-height: calc(100% - 24px); display: flex; flex-direction: column;
      background: var(--superficie); color: var(--texto); border-radius: 10px;
      box-shadow: 0 2px 14px rgba(0, 0, 0, 0.3);
    }
    .folha.direita { left: auto; right: 12px; width: 360px; }
    .conteudo { overflow-y: auto; padding: 0.875rem; overscroll-behavior: contain; }
    .alca { display: none; }
    @media (max-width: 600px) {
      .folha, .folha.direita {
        top: auto; left: 0; right: 0; bottom: 0; width: auto; max-height: none;
        border-radius: 16px 16px 0 0; transition: height 0.2s ease;
      }
      .folha.arrastando { transition: none; }
      .folha[data-tamanho='recolhido'] { height: ${ALTURA_RECOLHIDA_PX}px; }
      .folha[data-tamanho='meio'] { height: 45%; }
      .folha[data-tamanho='cheio'] { height: 88%; }
      .alca {
        display: flex; align-items: center; justify-content: center; width: 100%;
        min-height: 44px; border: 0; background: transparent; cursor: grab; touch-action: none;
      }
      .alca span { width: 44px; height: 5px; border-radius: 3px; background: var(--borda-forte); }
    }
  `,
})
export class BottomSheetComponent {
  readonly tamanho = model<TamanhoFolha>('meio');
  readonly lado = input<'esquerda' | 'direita'>('esquerda');
  readonly rotulo = input<string>('do mapa');

  protected readonly altura = signal<number | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private inicio: { y: number; altura: number; moveu: boolean } | null = null;

  private alturaContainer(): number {
    return this.host.nativeElement.parentElement?.clientHeight ?? window.innerHeight;
  }

  private alturaDe(t: TamanhoFolha): number {
    return t === 'recolhido' ? ALTURA_RECOLHIDA_PX : FRACAO[t] * this.alturaContainer();
  }

  protected comecar(e: PointerEvent): void {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.inicio = { y: e.clientY, altura: this.alturaDe(this.tamanho()), moveu: false };
  }

  protected mover(e: PointerEvent): void {
    if (!this.inicio) return;
    const dy = e.clientY - this.inicio.y;
    if (Math.abs(dy) > 5) this.inicio.moveu = true;
    if (!this.inicio.moveu) return;
    const max = this.alturaDe('cheio');
    this.altura.set(Math.min(max, Math.max(ALTURA_RECOLHIDA_PX, this.inicio.altura - dy)));
  }

  protected soltar(_e: PointerEvent): void {
    const ini = this.inicio;
    const alt = this.altura();
    this.inicio = null;
    this.altura.set(null);
    if (!ini) return;
    if (!ini.moveu || alt === null) return this.alternar();
    // Encaixa no tamanho mais próximo.
    const melhor = CICLO.reduce((a, b) => (Math.abs(this.alturaDe(b) - alt) < Math.abs(this.alturaDe(a) - alt) ? b : a));
    this.tamanho.set(melhor);
  }

  protected alternar(): void {
    this.tamanho.set(CICLO[(CICLO.indexOf(this.tamanho()) + 1) % CICLO.length]);
  }
}

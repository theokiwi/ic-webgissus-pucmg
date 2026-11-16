import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface ItemLegenda {
  cor: string;
  rotulo: string;
  /** Contorno visível para cores muito claras. */
  contorno?: boolean;
}

@Component({
  selector: 'app-legenda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legenda" role="group" [attr.aria-label]="'Legenda: ' + titulo()">
      <strong>{{ titulo() }}</strong>
      @if (unidade()) {
        <span class="muted"> · {{ unidade() }}</span>
      }
      <ul>
        @for (i of itens(); track i.rotulo) {
          <li>
            <span class="amostra" [style.background]="i.cor" [class.contorno]="i.contorno"></span>
            {{ i.rotulo }}
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .legenda { font-size: 0.8125rem; margin: 0; }
    ul { list-style: none; margin: 0.25rem 0 0; padding: 0; }
    li { display: flex; align-items: center; gap: 0.5rem; padding: 1px 0; }
    .amostra { width: 18px; height: 12px; border-radius: 2px; flex: none; }
    .contorno { border: 1px solid #8a8a8a; }
  `,
})
export class LegendaComponent {
  readonly titulo = input.required<string>();
  readonly unidade = input<string>('');
  readonly itens = input.required<readonly ItemLegenda[]>();
}

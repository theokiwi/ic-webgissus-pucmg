import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EstadoService } from '../core/estado.service';
import { CORES_DENSIDADE_SETOR, COR_SEM_DENSIDADE, rotulosDensidadeSetor, ZOOM_MINIMO_SETORES } from '../core/setores';
import { numero } from './formatadores';
import { LegendaComponent, type ItemLegenda } from './legenda.component';

/** Liga/desliga os setores censitários e mostra a legenda de densidade quando ligados. */
@Component({
  selector: 'app-controle-setores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LegendaComponent],
  template: `
    <div class="setores cartao">
      <label class="alternar">
        <input type="checkbox" [checked]="ligado()" (change)="estado.definirSetores($any($event.target).checked)" />
        <span>
          Setores censitários
          <small class="muted">Densidade da população nas áreas do Censo 2022 (IBGE)</small>
        </span>
      </label>
      @if (ligado()) {
        <div class="corpo">
          @if (!perto()) {
            <p class="muted dica" role="status">Os setores aparecem com o mapa mais próximo.</p>
            <button type="button" class="btn sec aproximar" (click)="estado.aproximarSetores()">Aproximar o mapa</button>
          }
          <app-legenda titulo="Densidade dos setores" unidade="hab/km²" [itens]="itens" />
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .alternar { display: flex; align-items: center; gap: 0.75rem; min-height: 56px; padding: 0.375rem 0; cursor: pointer; }
    .alternar input { flex: none; width: 20px; height: 20px; margin: 0; accent-color: var(--primaria); }
    .alternar span { display: flex; flex-direction: column; font-weight: 600; font-size: 0.9375rem; }
    .alternar small { font-weight: 400; font-size: 0.75rem; }
    .corpo { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem 0 0.875rem; border-top: 1px solid var(--borda); }
    .dica { margin: 0; font-size: 0.8125rem; }
    .aproximar { width: 100%; }
  `,
})
export class ControleSetoresComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly ligado = computed(() => this.estado.rota().setores);
  protected readonly perto = computed(() => this.estado.zoomMapa() >= ZOOM_MINIMO_SETORES);
  protected readonly itens: ItemLegenda[] = [
    ...rotulosDensidadeSetor(numero).map((rotulo, i) => ({ cor: CORES_DENSIDADE_SETOR[i], rotulo, contorno: true })),
    { cor: COR_SEM_DENSIDADE, rotulo: 'Sem dado', contorno: true },
  ];
}

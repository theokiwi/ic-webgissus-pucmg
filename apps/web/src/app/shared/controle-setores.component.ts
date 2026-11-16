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
    <div class="setores">
      <label class="alternar">
        <input type="checkbox" [checked]="ligado()" (change)="estado.definirSetores($any($event.target).checked)" />
        Setores censitários
      </label>
      @if (ligado() && !perto()) {
        <p class="muted dica" role="status">
          Os setores aparecem com o mapa mais próximo.
          <button type="button" class="btn sec aproximar" (click)="estado.aproximarSetores()">Aproximar o mapa</button>
        </p>
      }
      @if (ligado()) {
        <app-legenda titulo="Densidade dos setores" unidade="hab/km²" [itens]="itens" />
      }
    </div>
  `,
  styles: `
    .setores { margin: 0.75rem 0; padding: 0.5rem 0.75rem; border: 1px solid var(--borda); border-radius: 8px; }
    .alternar { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; font-weight: 600; cursor: pointer; }
    .alternar input { width: 20px; height: 20px; }
    .dica { margin: 0; font-size: 0.8125rem; }
    .aproximar { display: block; width: 100%; margin-top: 0.375rem; }
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

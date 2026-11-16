import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EstadoService } from '../../core/estado.service';
import { competenciaIso } from '../../shared/formatadores';

@Component({
  selector: 'app-cabecalho-painel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="cabecalho">
      <div>
        <h1>WebGIS SUS-MG</h1>
        <p class="muted">
          Saúde gratuita pelo SUS em Minas Gerais
          @if (estado.meta.dado(); as m) {
            · CNES {{ competencia(m.competencia) }}
          }
        </p>
      </div>
      <button type="button" class="btn sec" (click)="estado.limpar()">Limpar</button>
    </header>
  `,
  styles: `
    .cabecalho { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; padding-bottom: 1rem; }
    p { margin: 0.125rem 0 0; font-size: 0.8125rem; line-height: 1.35; }
    h1 { font-size: 1.125rem; margin: 0; }
  `,
})
export class CabecalhoPainelComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly competencia = competenciaIso;
}

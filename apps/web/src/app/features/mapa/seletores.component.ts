import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EstadoService } from '../../core/estado.service';

/**
 * Recorte por Macrorregião → Região de saúde, recolhido em "Filtros avançados" (ADR 0008):
 * útil a gestores e pesquisadores, pouco intuitivo para quem procura atendimento.
 */
@Component({
  selector: 'app-seletores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="avancados cartao" [open]="!!sel().macro || !!sel().regiao">
      <summary>
        <span>
          Filtros avançados
          <small class="muted">Macrorregiões e regiões de saúde do SUS-MG</small>
        </span>
      </summary>
      <div class="corpo">
        <div class="ctrl">
          <label for="sel-macro">Macrorregião de saúde</label>
          <select id="sel-macro" (change)="estado.selecionarMacro($any($event.target).value || null)">
            <option value="" [selected]="!sel().macro">Todas</option>
            @for (m of estado.macros(); track m.cd) {
              <option [value]="m.cd" [selected]="m.cd === sel().macro">{{ m.nome }}</option>
            }
          </select>
        </div>
        <div class="ctrl">
          <label for="sel-regiao">Região de saúde</label>
          <select id="sel-regiao" (change)="estado.selecionarRegiao($any($event.target).value || null)">
            <option value="" [selected]="!sel().regiao">Todas</option>
          @for (r of regioes(); track r.cd) {
            <option [value]="r.cd" [selected]="r.cd === sel().regiao">{{ r.nome }}</option>
          }
        </select>
      </div>
      <p class="muted dica">A lista e os totais passam a considerar só os municípios da região escolhida.</p>
      </div>
    </details>
  `,
  styles: `
    :host { display: block; }
    summary {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      min-height: 56px; padding: 0.375rem 0; cursor: pointer; list-style: none;
    }
    summary::-webkit-details-marker { display: none; }
    summary span { display: flex; flex-direction: column; font-weight: 600; font-size: 0.9375rem; }
    summary small { font-weight: 400; font-size: 0.75rem; }
    summary::after {
      content: ''; flex: none; width: 8px; height: 8px; margin-right: 4px;
      border-right: 2px solid var(--texto-suave); border-bottom: 2px solid var(--texto-suave);
      transform: rotate(45deg); transition: transform 0.15s;
    }
    .avancados[open] summary::after { transform: rotate(-135deg); }
    .corpo { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem 0 0.875rem; border-top: 1px solid var(--borda); }
    .corpo .ctrl { margin: 0; }
    .dica { font-size: 0.75rem; margin: 0; }
  `,
})
export class SeletoresComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly sel = this.estado.selecao;

  protected readonly regioes = computed(() => {
    const macro = this.sel().macro;
    const macros = this.estado.macros();
    return (macro ? macros.filter((m) => m.cd === macro) : macros).flatMap((m) => m.regioes);
  });
}

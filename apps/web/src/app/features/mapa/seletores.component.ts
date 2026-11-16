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
    <details class="avancados" [open]="!!sel().macro || !!sel().regiao">
      <summary>Filtros avançados: regiões de saúde</summary>
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
    </details>
  `,
  styles: `
    .avancados { margin: 0.5rem 0; border: 1px solid var(--borda); border-radius: 8px; padding: 0 0.75rem; }
    .avancados[open] { padding-bottom: 0.5rem; }
    summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
    .dica { font-size: 0.75rem; margin: 0.25rem 0 0; }
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

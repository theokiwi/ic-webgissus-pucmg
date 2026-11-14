import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { EstadoService } from '../../core/estado.service';

/** Macrorregião → Região de saúde → Município, encadeados. */
@Component({
  selector: 'app-seletores',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
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
    <div class="ctrl">
      <label for="sel-municipio">Município</label>
      <select id="sel-municipio" (change)="estado.selecionarMunicipio($any($event.target).value || null)">
        <option value="" [selected]="!sel().municipio">Selecione…</option>
        @for (m of municipios(); track m.cd) {
          <option [value]="m.cd" [selected]="m.cd === sel().municipio">{{ m.nome }}</option>
        }
      </select>
    </div>
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

  protected readonly municipios = computed(() =>
    [...this.estado.municipiosDoRecorte()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  );
}

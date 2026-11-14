import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CATEGORIAS } from '@webgissus/domain';
import { classesLegenda } from '../../core/escala';
import { EstadoService } from '../../core/estado.service';
import { TEMAS } from '../../core/temas';
import { decimal, numero, numeroCompacto } from '../../shared/formatadores';
import { LegendaComponent, type ItemLegenda } from '../../shared/legenda.component';
import { CabecalhoPainelComponent } from './cabecalho-painel.component';
import { SeletoresComponent } from './seletores.component';

/** Painel da visão MG / macrorregião / região de saúde. */
@Component({
  selector: 'app-painel-mg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CabecalhoPainelComponent, SeletoresComponent, LegendaComponent],
  template: `
    <app-cabecalho-painel />

    <div class="abas" role="tablist" aria-label="Tema do mapa">
      @for (t of temas; track t.id) {
        <button
          type="button"
          role="tab"
          [id]="'aba-' + t.id"
          [attr.aria-selected]="t.id === tema().id"
          [attr.aria-controls]="'lista-tema'"
          [class.ativa]="t.id === tema().id"
          (click)="estado.definirTema(t.id)"
        >
          {{ t.rotulo }}
        </button>
      }
    </div>

    <section class="resumo" aria-label="Totais">
      <div><b>{{ num(totais().municipios) }}</b> municípios</div>
      <div><b>{{ num(totais().estabelecimentos) }}</b> estabelecimentos</div>
      <div><b>{{ num(totais().populacao) }}</b> habitantes</div>
    </section>
    <ul class="cats" aria-label="Estabelecimentos por categoria">
      @for (c of categorias; track c.slug) {
        @if (totais().porCategoria[c.slug]; as n) {
          <li><span class="sw" [style.background]="c.cor" aria-hidden="true"></span>{{ c.rotulo }}<b>{{ num(n) }}</b></li>
        }
      }
    </ul>

    <app-seletores />

    <app-legenda [titulo]="tema().titulo" [unidade]="tema().unidade" [itens]="itensLegenda()" />

    <h2 class="sub" id="titulo-lista">Municípios com os maiores valores (até 100)</h2>
    <ul class="lista" id="lista-tema" role="tabpanel" aria-labelledby="titulo-lista">
      @for (r of estado.ranking(); track r.m.cd) {
        <li>
          <button type="button" (click)="estado.selecionarMunicipio(r.m.cd)">
            <span class="nome">{{ r.m.nome }}</span>
            <b>{{ valor(r.v) }}</b>
          </button>
        </li>
      } @empty {
        <li class="muted vazio">Nenhum município para exibir.</li>
      }
    </ul>
    <p class="fonte muted">
      Malha e população: IBGE · Estabelecimentos: CNES/DATASUS (apenas os que atendem pelo SUS). Mapa base: © OpenStreetMap,
      OpenFreeMap.
    </p>
  `,
  styles: `
    .abas { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin: 0.75rem 0; }
    .abas button {
      min-height: 44px; border: 1px solid var(--borda-forte); background: var(--superficie); color: var(--texto);
      border-radius: 8px; font: inherit; font-size: 0.8125rem; cursor: pointer; padding: 0 6px;
    }
    .abas button.ativa { background: var(--primaria); border-color: var(--primaria); color: #fff; font-weight: 600; }
    .resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 0.75rem; text-align: center; margin-bottom: 0.5rem; }
    .resumo b { display: block; font-size: 1.0625rem; }
    .cats { list-style: none; margin: 0 0 0.75rem; padding: 0; font-size: 0.8125rem; columns: 1; }
    .cats li { display: flex; align-items: center; gap: 0.5rem; padding: 1px 0; }
    .cats b { margin-left: auto; }
    .sub { font-size: 0.875rem; margin: 0.5rem 0 0.25rem; }
    .vazio { padding: 0.5rem 0; }
    .fonte { font-size: 0.75rem; }
  `,
})
export class PainelMgComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly temas = TEMAS;
  protected readonly categorias = CATEGORIAS;
  protected readonly tema = this.estado.temaDef;
  protected readonly totais = this.estado.totaisRecorte;
  protected readonly num = numero;

  protected readonly itensLegenda = computed<ItemLegenda[]>(() => {
    const t = this.tema();
    const classes = classesLegenda(this.estado.quebras(), t.cores, numeroCompacto).map((c) => ({
      ...c,
      contorno: true,
    }));
    return [...classes, { cor: '#d9d9d9', rotulo: 'Sem dado', contorno: true }];
  });

  protected valor(v: number | null): string {
    return v === null ? '—' : this.tema().casas ? decimal(v, this.tema().casas) : numero(v);
  }
}

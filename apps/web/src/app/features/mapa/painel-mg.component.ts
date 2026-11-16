import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORIAS } from '@webgissus/domain';
import { classesLegenda } from '../../core/escala';
import { EstadoService } from '../../core/estado.service';
import { TEMAS } from '../../core/temas';
import { ControleSetoresComponent } from '../../shared/controle-setores.component';
import { decimal, numero, numeroCompacto } from '../../shared/formatadores';
import { LegendaComponent, type ItemLegenda } from '../../shared/legenda.component';
import { CabecalhoPainelComponent } from './cabecalho-painel.component';
import { BuscaGlobalComponent } from './busca-global.component';
import { BuscaLugarComponent } from './busca-lugar.component';
import { SeletoresComponent } from './seletores.component';

/** Painel da visão MG / macrorregião / região de saúde. */
@Component({
  selector: 'app-painel-mg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CabecalhoPainelComponent, BuscaLugarComponent, BuscaGlobalComponent, SeletoresComponent, LegendaComponent, ControleSetoresComponent, RouterLink],
  template: `
    <app-cabecalho-painel />

    <section class="secao" aria-labelledby="t-encontrar">
      <h2 class="secao-titulo" id="t-encontrar">Encontrar atendimento</h2>
      <app-busca-lugar />
      <button type="button" class="btn perto" (click)="estado.pertoDeMim()">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
        </svg>
        Perto de mim
      </button>
      <app-busca-global />
    </section>

    <section class="secao" aria-labelledby="t-numeros">
      <h2 class="secao-titulo" id="t-numeros">{{ nomeRecorte() }} em números</h2>
      <div class="resumo">
        <div><b>{{ num(totais().municipios) }}</b> municípios</div>
        <div><b>{{ num(totais().estabelecimentos) }}</b> estabelecimentos</div>
        <div><b>{{ num(totais().populacao) }}</b> habitantes</div>
      </div>
      <ul class="cats" aria-label="Estabelecimentos por categoria">
        @for (c of categorias; track c.slug) {
          @if (totais().porCategoria[c.slug]; as n) {
            <li><span class="sw" [style.background]="c.cor" aria-hidden="true"></span>{{ c.rotulo }}<b>{{ num(n) }}</b></li>
          }
        }
      </ul>
    </section>

    <section class="secao" aria-labelledby="t-mapa">
      <h2 class="secao-titulo" id="t-mapa">Colorir municípios por</h2>
      <div class="abas" role="tablist" aria-labelledby="t-mapa">
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
      <app-legenda [titulo]="tema().titulo" [unidade]="tema().unidade" [itens]="itensLegenda()" />
      <app-controle-setores />
      <app-seletores />
    </section>

    <section class="secao" aria-labelledby="titulo-lista">
      <h2 class="secao-titulo" id="titulo-lista">Municípios com os maiores valores</h2>
      <ul class="lista" id="lista-tema" role="tabpanel" aria-labelledby="titulo-lista">
        @for (r of estado.ranking(); track r.m.cd; let i = $index) {
          <li>
            <button type="button" (click)="estado.selecionarMunicipio(r.m.cd)">
              <span class="pos">{{ i + 1 }}</span>
              <span class="nome">{{ r.m.nome }}</span>
              <b>{{ valor(r.v) }}</b>
            </button>
          </li>
        } @empty {
          <li class="muted vazio">Nenhum município para exibir.</li>
        }
      </ul>
      <footer class="fonte muted">
        <p>
          Malha e população: IBGE · Estabelecimentos: CNES/DATASUS (apenas os que atendem pelo SUS). Mapa base: © OpenStreetMap,
          OpenFreeMap.
        </p>
        <p><a routerLink="/sobre">Sobre e fontes dos dados</a> · <a routerLink="/privacidade">Privacidade</a></p>
      </footer>
    </section>
  `,
  styles: `
    .perto { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 48px; font-size: 1rem; }
    .abas { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .abas button {
      min-height: 44px; border: 1px solid var(--borda); background: var(--superficie); color: var(--texto);
      border-radius: 8px; font: inherit; font-size: 0.8125rem; cursor: pointer; padding: 0 6px;
    }
    .abas button:hover { border-color: var(--borda-forte); }
    .abas button.ativa { background: var(--primaria); border-color: var(--primaria); color: #fff; font-weight: 600; }
    .resumo { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .resumo div {
      background: var(--destaque); border-radius: 8px; padding: 0.5rem 0.25rem;
      font-size: 0.75rem; text-align: center; color: var(--texto-suave);
    }
    .resumo b { display: block; font-size: 1.0625rem; color: var(--texto); }
    .cats { list-style: none; margin: 0; padding: 0; font-size: 0.8125rem; }
    .cats li { display: flex; align-items: center; gap: 0.5rem; padding: 3px 0; }
    .cats b { margin-left: auto; }
    .pos { min-width: 1.75rem; color: var(--texto-suave); font-size: 0.75rem; font-variant-numeric: tabular-nums; }
    .lista b { font-variant-numeric: tabular-nums; }
    .vazio { padding: 0.5rem 0; }
    .fonte { font-size: 0.75rem; }
    .fonte p { margin: 0 0 0.375rem; }
  `,
})
export class PainelMgComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly temas = TEMAS;
  protected readonly categorias = CATEGORIAS;
  protected readonly tema = this.estado.temaDef;
  protected readonly totais = this.estado.totaisRecorte;
  protected readonly num = numero;

  /** "Minas Gerais", ou o nome da macrorregião / região de saúde escolhida nos filtros avançados. */
  protected readonly nomeRecorte = computed(() => {
    const s = this.estado.selecao();
    const macro = this.estado.macros().find((m) => m.cd === s.macro);
    const regiao = macro?.regioes.find((r) => r.cd === s.regiao);
    return regiao?.nome ?? macro?.nome ?? 'Minas Gerais';
  });

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

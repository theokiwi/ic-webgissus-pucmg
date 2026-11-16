import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORIAS, categoria, type CategoriaSlug } from '@webgissus/domain';
import { EstadoService } from '../../core/estado.service';
import { CompartilharComponent } from '../../shared/compartilhar.component';
import { ControleSetoresComponent } from '../../shared/controle-setores.component';
import { decimal, numero } from '../../shared/formatadores';
import { CabecalhoPainelComponent } from '../mapa/cabecalho-painel.component';
import { BuscaLugarComponent } from '../mapa/busca-lugar.component';

const LIMITE_LISTA = 200;

@Component({
  selector: 'app-painel-municipio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CabecalhoPainelComponent, BuscaLugarComponent, CompartilharComponent, ControleSetoresComponent],
  template: `
    <app-cabecalho-painel />
    <button type="button" class="btn sec voltar" (click)="estado.irParaMg()">&larr; Voltar para MG</button>

    @if (estado.municipio.dado(); as m) {
      <h2 class="titulo">{{ m.nome }}</h2>
      <p class="muted sub">{{ m.nomeRegiao }} · {{ m.nomeMacro }}</p>
      <section class="resumo" aria-label="Indicadores do município">
        <div><b>{{ num(m.populacao) }}</b> habitantes</div>
        <div><b>{{ dec(m.densidade) }}</b> hab/km²</div>
        <div><b>{{ num(m.totalEstabelecimentos) }}</b> estabelecimentos</div>
        <div><b>{{ dec(m.estabelecimentosPor10mil) }}</b> por 10 mil hab.</div>
      </section>
      <app-compartilhar [contexto]="{ tipo: 'municipio', nome: m.nome, totalEstabelecimentos: m.totalEstabelecimentos, populacao: m.populacao }" />
    } @else if (estado.municipio.erro(); as e) {
      <p class="erro" role="alert">{{ e }}</p>
    }

    <app-busca-lugar />
    <app-controle-setores />

    <div class="ctrl">
      <label for="filtro-local">Filtrar por nome ou bairro</label>
      <input
        id="filtro-local"
        type="search"
        autocomplete="off"
        [value]="estado.rota().q"
        (input)="estado.filtrarTexto($any($event.target).value)"
      />
    </div>

    <h2 class="sub2" id="titulo-cats">Categorias (legenda e filtro)</h2>
    <ul class="chips" aria-labelledby="titulo-cats">
      @for (c of categorias; track c.slug) {
        @if (contagem()[c.slug] || estado.rota().cat === c.slug) {
          <li>
            <button
              type="button"
              class="chip"
              [attr.aria-pressed]="estado.rota().cat === c.slug"
              [class.ativo]="estado.rota().cat === c.slug"
              (click)="estado.filtrarCategoria(c.slug)"
            >
              <span class="sw" [style.background]="c.cor" aria-hidden="true"></span>
              {{ c.rotulo }}
              <b>{{ num(contagem()[c.slug] ?? 0) }}</b>
            </button>
          </li>
        }
      }
    </ul>

    <p class="muted" aria-live="polite">
      @if (estado.pontos.dado()) {
        {{ num(visiveis().length) }} de {{ num(estado.pontos.dado()!.features.length) }} estabelecimentos no mapa
      }
    </p>
    <ul class="lista" aria-label="Estabelecimentos do município">
      @for (f of lista(); track f.properties.cnes) {
        <li>
          <button type="button" (click)="estado.abrirEstabelecimento(f.properties.cnes)">
            <span class="sw" [style.background]="cor(f.properties.categoria)" aria-hidden="true"></span>
            <span class="nome">{{ f.properties.nome }}</span>
            <span class="muted">{{ f.properties.bairro }}</span>
          </button>
        </li>
      }
    </ul>
    @if (visiveis().length > lista().length) {
      <p class="muted">Mostrando os {{ lista().length }} primeiros. Use o filtro para refinar.</p>
    }
    <p class="muted rodape-links">
      <a routerLink="/sobre">Sobre e fontes dos dados</a> · <a routerLink="/privacidade">Privacidade</a>
    </p>
  `,
  styles: `
    .rodape-links { font-size: 0.75rem; }
    .voltar { margin: 0.5rem 0; width: 100%; }
    .titulo { margin: 0.25rem 0 0; font-size: 1.25rem; }
    .sub { margin: 0 0 0.5rem; font-size: 0.8125rem; }
    .sub2 { font-size: 0.875rem; margin: 0.5rem 0 0.25rem; }
    .resumo { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.75rem; margin-bottom: 0.5rem; }
    .resumo b { display: block; font-size: 1.0625rem; }
    .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; padding: 0 0.75rem;
      border: 1px solid var(--borda-forte); border-radius: 22px; background: var(--superficie);
      color: var(--texto); font: inherit; font-size: 0.8125rem; cursor: pointer;
    }
    .chip.ativo { border-color: var(--primaria); box-shadow: inset 0 0 0 1px var(--primaria); background: var(--destaque); }
  `,
})
export class PainelMunicipioComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly categorias = CATEGORIAS;
  protected readonly contagem = this.estado.contagemPorCategoria;
  protected readonly visiveis = this.estado.pontosVisiveis;
  protected readonly num = numero;
  protected readonly dec = (n: number | null) => decimal(n, 1);

  protected readonly lista = computed(() =>
    [...this.visiveis()]
      .sort((a, b) => a.properties.nome.localeCompare(b.properties.nome, 'pt-BR'))
      .slice(0, LIMITE_LISTA),
  );

  protected cor(slug: CategoriaSlug): string {
    return categoria(slug).cor;
  }
}

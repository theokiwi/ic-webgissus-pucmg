import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { CATEGORIAS, categoria, situacaoFuncionamento, type ProximoDTO } from '@webgissus/domain';
import { EstadoService } from '../../core/estado.service';
import { distancia, numero } from '../../shared/formatadores';
import { descreverMudanca, rotuloSituacao } from '../../shared/situacao';

/** Painel "Perto de mim": estabelecimentos mais próximos de um ponto (GET /api/estabelecimentos/proximos). */
@Component({
  selector: 'app-painel-perto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="cab">
      <h1>Perto de mim</h1>
      <button type="button" class="btn sec" (click)="estado.irParaMg()">&larr; Voltar para MG</button>
    </header>

    <p class="emergencia" role="note">
      <b>Em emergência, ligue 192 (SAMU).</b>
    </p>
    <button
      type="button"
      class="btn urgencia"
      [disabled]="!ponto()"
      [attr.aria-pressed]="cat() === 'urgencia'"
      (click)="estado.filtrarCategoria('urgencia')"
    >
      Urgência: unidades mais próximas
    </button>

    @if (!ponto()) {
      <section class="origem" aria-live="polite">
        @if (loc.status() === 'buscando') {
          <p><span class="giro" aria-hidden="true"></span> Buscando sua localização…</p>
        } @else {
          <p>Para listar os estabelecimentos mais próximos, informe onde você está.</p>
        }
        @if (loc.erro(); as e) {
          <p class="erro" role="alert">{{ e }}</p>
        }
        <div class="acoes">
          <button type="button" class="btn" [disabled]="loc.status() === 'buscando'" (click)="estado.atualizarPosicao()">
            Usar minha localização
          </button>
          <button type="button" class="btn sec" (click)="estado.escolherNoMapa('perto')">Escolher no mapa</button>
        </div>
      </section>
    } @else {
      <div class="acoes pequenas">
        <button type="button" class="btn sec" [disabled]="loc.status() === 'buscando'" (click)="estado.atualizarPosicao()">
          Atualizar minha localização
        </button>
        <button type="button" class="btn sec" (click)="estado.escolherNoMapa('perto')">Escolher outro ponto</button>
      </div>
      @if (loc.erro(); as e) {
        <p class="erro" role="alert">{{ e }}</p>
      }

      <h2 class="sub" id="titulo-cat-perto">Filtrar por categoria</h2>
      <ul class="chips" aria-labelledby="titulo-cat-perto">
        <li>
          <button type="button" class="chip" [class.ativo]="!cat()" [attr.aria-pressed]="!cat()" (click)="estado.filtrarCategoria(null)">
            Todas
          </button>
        </li>
        @for (c of categorias; track c.slug) {
          <li>
            <button
              type="button"
              class="chip"
              [class.ativo]="cat() === c.slug"
              [attr.aria-pressed]="cat() === c.slug"
              (click)="estado.filtrarCategoria(c.slug)"
            >
              <span class="sw" [style.background]="c.cor" aria-hidden="true"></span>{{ c.rotulo }}
            </button>
          </li>
        }
      </ul>

      <div aria-live="polite" class="status">
        @if (estado.perto.carregando()) {
          <p class="muted">Buscando estabelecimentos…</p>
        } @else if (estado.perto.dado(); as itens) {
          <p class="muted">
            {{ numero(itens.length) }} {{ itens.length === 1 ? 'estabelecimento' : 'estabelecimentos' }} em até
            {{ raio() }} km (distância em linha reta)
          </p>
        }
      </div>
      @if (estado.perto.erro(); as e) {
        <p class="erro" role="alert">{{ e }}</p>
        <button type="button" class="btn sec" (click)="estado.tentarNovamente()">Tentar novamente</button>
      }

      @if (estado.perto.dado(); as itens) {
        @if (itens.length === 0) {
          <section class="vazio">
            <p>Nenhum estabelecimento{{ cat() ? ' dessa categoria' : '' }} em até {{ raio() }} km deste ponto.</p>
            @if (raio() === 30) {
              <button type="button" class="btn" (click)="estado.ampliarRaio()">Ampliar para 100 km</button>
            } @else {
              <p class="muted">Tente escolher outro ponto ou outra categoria.</p>
            }
          </section>
        } @else {
          <ol class="resultados" aria-label="Estabelecimentos mais próximos">
            @for (i of linhas(); track i.p.cnes) {
              <li>
                <button type="button" (click)="estado.abrirEstabelecimento(i.p.cnes)">
                  <span class="ordem" [style.background]="i.cor" aria-hidden="true">{{ i.n }}</span>
                  <span class="corpo">
                    <span class="nome">{{ i.p.nome }}</span>
                    <span class="muted linha">{{ i.rotulo }} · {{ i.p.municipio }}</span>
                    <span class="linha">
                      <span class="situacao" [attr.data-estado]="i.estado">{{ i.situacao }}</span>
                      @if (i.mudanca) {
                        <span class="muted"> · {{ i.mudanca }}</span>
                      }
                    </span>
                  </span>
                  <b class="dist">{{ i.dist }}</b>
                </button>
              </li>
            }
          </ol>
          @if (raio() === 30) {
            <button type="button" class="btn sec ampliar" (click)="estado.ampliarRaio()">Ampliar para 100 km</button>
          }
        }
      }
    }

    <p class="privacidade muted">
      Sua localização é usada só para esta consulta: não é guardada nem enviada a ninguém além da busca. A URL guarda o ponto
      com precisão reduzida (cerca de 10 m).
    </p>
  `,
  styles: `
    .cab { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
    h1 { font-size: 1.125rem; margin: 0; }
    .emergencia { margin: 0 0 0.5rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: #fdecea; color: #7f1d1d; border-left: 5px solid #b71c1c; }
    .urgencia { width: 100%; background: #b71c1c; margin-bottom: 0.5rem; }
    .urgencia[aria-pressed='true'] { box-shadow: 0 0 0 3px #fff, 0 0 0 5px #b71c1c; }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0; }
    .acoes .btn { flex: 1 1 140px; }
    .acoes.pequenas .btn { font-size: 0.8125rem; padding: 0 0.5rem; }
    .origem { margin: 0.5rem 0; }
    .sub { font-size: 0.875rem; margin: 0.5rem 0 0.25rem; }
    .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      display: inline-flex; align-items: center; gap: 0.4rem; min-height: 44px; padding: 0 0.75rem;
      border: 1px solid var(--borda-forte); border-radius: 22px; background: var(--superficie);
      color: var(--texto); font: inherit; font-size: 0.8125rem; cursor: pointer;
    }
    .chip.ativo { border-color: var(--primaria); box-shadow: inset 0 0 0 1px var(--primaria); background: var(--destaque); font-weight: 600; }
    .status p { margin: 0.5rem 0 0.25rem; font-size: 0.8125rem; }
    .resultados { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--borda); }
    .resultados li { border-bottom: 1px solid var(--borda); }
    .resultados button {
      display: flex; align-items: flex-start; gap: 0.625rem; width: 100%; min-height: 44px; padding: 0.5rem 0.25rem;
      background: transparent; border: 0; font: inherit; text-align: left; color: var(--texto); cursor: pointer;
    }
    .resultados button:hover { background: var(--destaque); }
    .ordem { flex: none; width: 24px; height: 24px; border-radius: 50%; color: #fff; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; text-shadow: 0 0 2px rgba(0,0,0,.6); }
    .corpo { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
    .linha { font-size: 0.8125rem; }
    .dist { flex: none; font-size: 0.875rem; white-space: nowrap; }
    .situacao { font-weight: 700; }
    .situacao[data-estado='aberto'], .situacao[data-estado='24h'] { color: #1b5e20; }
    .situacao[data-estado='fechado'] { color: #b71c1c; }
    .vazio { margin: 0.5rem 0; }
    .ampliar { width: 100%; margin-top: 0.5rem; }
    .privacidade { font-size: 0.75rem; margin-top: 1rem; }
    .giro { display: inline-block; width: 14px; height: 14px; border: 3px solid var(--borda-forte); border-top-color: var(--primaria); border-radius: 50%; animation: gira 0.8s linear infinite; vertical-align: middle; }
    @keyframes gira { to { transform: rotate(360deg); } }
  `,
})
export class PainelPertoComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly loc = this.estado.localizacao;
  protected readonly categorias = CATEGORIAS;
  protected readonly numero = numero;

  protected readonly ponto = computed(() => this.estado.rota().ponto);
  protected readonly cat = computed(() => this.estado.rota().cat);
  protected readonly raio = computed(() => this.estado.rota().raio);

  private readonly agora = signal(new Date());

  protected readonly linhas = computed(() =>
    (this.estado.perto.dado() ?? []).map((p: ProximoDTO, idx) => {
      const sit = situacaoFuncionamento(p.horarios, p.sempreAberto, this.agora());
      return {
        p,
        n: idx + 1,
        cor: categoria(p.categoria).cor,
        rotulo: categoria(p.categoria).rotulo,
        dist: distancia(p.distanciaM),
        estado: sit.estado,
        situacao: rotuloSituacao(sit),
        mudanca: descreverMudanca(sit, this.agora()),
      };
    }),
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const t = setInterval(() => this.agora.set(new Date()), 60_000);
      destroyRef.onDestroy(() => clearInterval(t));
    });
  }
}

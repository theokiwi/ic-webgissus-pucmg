import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { ModoRota } from '@webgissus/domain';
import { EstadoService, MSG_ROTA_INDISPONIVEL } from '../../core/estado.service';
import { distancia, duracao } from '../../shared/formatadores';
import { linksExternos } from '../../shared/rota-links';

const MODOS: { modo: ModoRota; rotulo: string }[] = [
  { modo: 'auto', rotulo: 'Carro' },
  { modo: 'pedestre', rotulo: 'A pé' },
  { modo: 'bicicleta', rotulo: 'Bicicleta' },
];

/** Seção "Como chegar" da ficha: modo, origem, rota calculada (GET /api/rota) e links externos. */
@Component({
  selector: 'app-como-chegar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!visivel()) {
      <button type="button" class="btn chegar" (click)="aberto.set(true)">Como chegar</button>
    } @else {
      <section class="rota" aria-labelledby="h-chegar">
        <h3 id="h-chegar">Como chegar</h3>
        <div class="modos" role="group" aria-label="Modo de deslocamento">
          @for (m of modos; track m.modo) {
            <button
              type="button"
              class="modo"
              [class.ativo]="modoAtual() === m.modo"
              [attr.aria-pressed]="modoAtual() === m.modo"
              (click)="estado.comoChegar(m.modo)"
            >
              {{ m.rotulo }}
            </button>
          }
        </div>

        <div aria-live="polite">
          @if (!modoRota()) {
            <p class="muted">Escolha como você vai: usamos sua localização como ponto de partida.</p>
          } @else if (!de()) {
            @if (loc.status() === 'buscando') {
              <p class="muted">Obtendo sua localização…</p>
            } @else {
              @if (loc.erro(); as e) {
                <p class="erro" role="alert">{{ e }}</p>
              } @else {
                <p class="muted">Precisamos do ponto de partida.</p>
              }
              <div class="acoes">
                <button type="button" class="btn sec" (click)="estado.comoChegar(modoRota()!)">Tentar de novo</button>
                <button type="button" class="btn sec" (click)="estado.escolherNoMapa('rota')">Tocar no mapa</button>
              </div>
            }
          } @else if (calculo.carregando()) {
            <p class="muted">Calculando a rota…</p>
          } @else if (calculo.erro(); as e) {
            <p class="erro" role="alert">{{ e }}</p>
            @if (e !== indisponivel) {
              <button type="button" class="btn sec" (click)="estado.tentarNovamente()">Tentar novamente</button>
            }
          } @else if (calculo.dado(); as r) {
            <p class="resumo" role="status">
              <b>{{ dist(r.distanciaM) }}</b> · <b>{{ tempo(r.duracaoS) }}</b>
              <span class="muted"> ({{ rotuloModo() }})</span>
            </p>
            <details class="passos">
              <summary>Instruções passo a passo ({{ r.passos.length }})</summary>
              <ol>
                @for (p of r.passos; track $index) {
                  <li>
                    {{ p.instrucao }}
                    @if (p.distanciaM > 0) {
                      <span class="muted"> · {{ dist(p.distanciaM) }}</span>
                    }
                  </li>
                }
              </ol>
            </details>
          }
        </div>

        @if (de()) {
          <div class="acoes">
            <button type="button" class="btn sec" (click)="estado.escolherNoMapa('rota')">Mudar ponto de partida</button>
          </div>
        }
        @if (modoRota()) {
          <button type="button" class="btn sec limpar" (click)="limpar()">Limpar rota</button>
        }

        @if (links(); as l) {
          <p class="externo">
            <a class="btn sec app" [href]="l.geo">Abrir no app de mapas</a>
            <span class="alt">
              <a [href]="l.google" target="_blank" rel="noopener">Google Maps</a>
              <a [href]="l.osm" target="_blank" rel="noopener">OpenStreetMap</a>
            </span>
          </p>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; margin: 0.5rem 0; }
    .chegar { width: 100%; }
    h3 { font-size: 0.9375rem; margin: 0.5rem 0 0.25rem; }
    .modos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
    .modo {
      min-height: 44px; border: 1px solid var(--borda-forte); background: var(--superficie); color: var(--texto);
      border-radius: 8px; font: inherit; font-size: 0.875rem; cursor: pointer;
    }
    .modo.ativo { background: var(--primaria); border-color: var(--primaria); color: #fff; font-weight: 600; }
    .resumo { margin: 0.5rem 0 0.25rem; font-size: 1.0625rem; }
    .passos { margin: 0.25rem 0; font-size: 0.875rem; }
    .passos summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 600; color: var(--primaria); }
    .passos ol { margin: 0; padding-left: 1.25rem; }
    .passos li { padding: 2px 0; }
    .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0; }
    .limpar { width: 100%; margin-top: 0.25rem; }
    .externo { display: flex; flex-direction: column; gap: 0.25rem; margin: 0.75rem 0 0; font-size: 0.875rem; }
    .externo .app { display: flex; align-items: center; justify-content: center; text-decoration: none; }
    .alt { display: flex; gap: 1.25rem; justify-content: center; }
    .externo a:not(.btn) { display: inline-flex; align-items: center; min-height: 44px; }
  `,
})
export class ComoChegarComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly loc = this.estado.localizacao;
  protected readonly calculo = this.estado.rotaCalculada;
  protected readonly modos = MODOS;
  protected readonly indisponivel = MSG_ROTA_INDISPONIVEL;
  protected readonly dist = distancia;
  protected readonly tempo = duracao;
  protected readonly aberto = signal(false);

  protected readonly modoRota = computed(() => this.estado.rota().modoRota);
  protected readonly de = computed(() => this.estado.rota().de);
  protected readonly modoAtual = this.modoRota;
  protected readonly visivel = computed(() => this.aberto() || this.modoRota() !== null);
  protected readonly rotuloModo = computed(() => MODOS.find((m) => m.modo === this.modoRota())?.rotulo.toLowerCase() ?? '');

  protected readonly links = computed(() => {
    const f = this.estado.ficha.dado();
    return f ? linksExternos({ lat: f.lat, lon: f.lon, nome: f.nome }, this.modoRota() ?? 'auto') : null;
  });

  protected limpar(): void {
    this.estado.limparRota();
    this.aberto.set(false);
  }
}

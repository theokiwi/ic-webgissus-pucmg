import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rotuloCategoria, categoria } from '@webgissus/domain';
import { ApiService } from '../../core/api.service';
import { carregar } from '../../core/carregar';
import { EstadoService } from '../../core/estado.service';

const MIN_CARACTERES = 2;
const ATRASO_MS = 300;

/** Busca de estabelecimentos em todo o estado (GET /api/estabelecimentos/busca). */
@Component({
  selector: 'app-busca-global',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ctrl">
      <label for="busca-global">Buscar estabelecimento em MG</label>
      <input
        id="busca-global"
        type="search"
        autocomplete="off"
        placeholder="Nome da unidade, ex.: UPA Centro"
        [value]="texto()"
        (input)="digitar($any($event.target).value)"
      />
    </div>
    <div aria-live="polite" class="muted resumo-busca">
      @if (busca.carregando()) {
        Buscando…
      } @else if (busca.erro(); as e) {
        <span class="erro">{{ e }}</span>
      } @else if (termo() && resultados().length === 0) {
        Nenhum estabelecimento encontrado.
      }
    </div>
    @if (resultados().length) {
      <ul class="lista" aria-label="Resultados da busca">
        @for (r of resultados(); track r.cnes) {
          <li>
            <button type="button" (click)="abrir(r.cnes)">
              <span class="sw" [style.background]="cor(r.categoria)" aria-hidden="true"></span>
              <span class="nome">{{ r.nome }}</span>
              <span class="muted">{{ r.municipio }}{{ r.bairro ? ' · ' + r.bairro : '' }} · {{ rotulo(r.categoria) }}</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .resumo-busca { min-height: 1.1em; font-size: 0.8125rem; }
  `,
})
export class BuscaGlobalComponent {
  private readonly api = inject(ApiService);
  private readonly estado = inject(EstadoService);

  protected readonly texto = signal('');
  /** Termo já "estabilizado" (depois do atraso), que dispara a requisição. */
  protected readonly termo = signal('');
  protected readonly busca = carregar(
    computed(() => (this.termo().length >= MIN_CARACTERES ? this.termo() : null)),
    (q) => this.api.busca(q, 10),
  );
  protected readonly resultados = computed(() => this.busca.dado() ?? []);
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected digitar(valor: string): void {
    this.texto.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.termo.set(valor.trim()), ATRASO_MS);
  }

  protected abrir(cnes: string): void {
    this.texto.set('');
    this.termo.set('');
    this.estado.abrirEstabelecimento(cnes);
  }

  protected cor = (slug: Parameters<typeof categoria>[0]) => categoria(slug).cor;
  protected rotulo = rotuloCategoria;
}

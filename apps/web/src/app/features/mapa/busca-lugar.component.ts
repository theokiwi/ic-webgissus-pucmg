import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { LugarDTO, TipoLugar } from '@webgissus/domain';
import { ApiService } from '../../core/api.service';
import { municipiosQueCasam } from '../../core/busca-municipio';
import { carregar } from '../../core/carregar';
import { EstadoService } from '../../core/estado.service';
import { normalizar } from '../../shared/formatadores';

const MIN_MUNICIPIO = 2;
/** Igual ao mínimo da API (`BUSCA_MIN_CHARS`). */
const MIN_LUGAR = 3;
const ATRASO_MS = 400;

const ROTULO_TIPO: Record<TipoLugar, string> = {
  bairro: 'Bairro',
  rua: 'Rua',
  endereco: 'Endereço',
  cidade: 'Localidade',
  local: 'Local',
};

/**
 * Busca de lugar (ADR 0008): o município abre o painel do município; bairro, rua ou
 * endereço (geocodificador OSM via `/api/lugares`) abre "Perto de…" naquele ponto.
 */
@Component({
  selector: 'app-busca-lugar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ctrl">
      <label for="busca-lugar">Município, bairro ou endereço</label>
      <input
        id="busca-lugar"
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        placeholder="Ex.: Contagem, Savassi, Rua da Bahia 100"
        [value]="texto()"
        (input)="digitar($any($event.target).value)"
      />
    </div>
    <div aria-live="polite" class="muted resumo-busca">
      @if (lugares.carregando()) {
        Buscando bairros e endereços…
      } @else if (lugares.erro()) {
        <span class="erro">A busca de bairros e endereços está indisponível agora.</span>
      } @else if (termo().length >= minLugar && vazio()) {
        Nada encontrado em Minas Gerais.
      }
    </div>
    @if (municipios().length || resultadosLugar().length) {
      <ul class="lista" aria-label="Lugares encontrados">
        @for (m of municipios(); track m.cd) {
          <li>
            <button type="button" (click)="abrirMunicipio(m.cd)">
              <span class="nome">{{ m.nome }}</span>
              <span class="muted">Município</span>
            </button>
          </li>
        }
        @for (l of resultadosLugar(); track $index) {
          <li>
            <button type="button" (click)="abrirLugar(l)">
              <span class="nome">{{ l.nome }}</span>
              <span class="muted">{{ rotulo[l.tipo] }}{{ l.descricao ? ' · ' + l.descricao : '' }} · ver unidades perto</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .resumo-busca { font-size: 0.8125rem; }
    .resumo-busca:not(:empty) { margin-top: 0.375rem; }
    .lista { margin-top: 0.375rem; }
    .lista li > button .muted { padding-left: 0; }
  `,
})
export class BuscaLugarComponent {
  private readonly api = inject(ApiService);
  private readonly estado = inject(EstadoService);
  protected readonly rotulo = ROTULO_TIPO;
  protected readonly minLugar = MIN_LUGAR;

  protected readonly texto = signal('');
  /** Termo estabilizado (depois do atraso), que dispara a consulta ao geocodificador. */
  protected readonly termo = signal('');
  protected readonly lugares = carregar(
    computed(() => (this.termo().length >= MIN_LUGAR ? this.termo() : null)),
    (q) => this.api.lugares(q, 5),
  );

  /** Municípios casam na hora, a partir da lista já carregada. */
  protected readonly municipios = computed(() => {
    const t = this.texto().trim();
    return t.length >= MIN_MUNICIPIO ? municipiosQueCasam(this.estado.listaMunicipios(), t) : [];
  });

  /** Lugares do geocodificador, sem repetir como "localidade" um município já listado. */
  protected readonly resultadosLugar = computed(() => {
    const nomes = new Set(this.estado.listaMunicipios().map((m) => normalizar(m.nome)));
    return (this.lugares.dado() ?? []).filter((l) => !(l.tipo === 'cidade' && nomes.has(normalizar(l.nome))));
  });

  protected readonly vazio = computed(
    () => !!this.lugares.dado() && this.municipios().length === 0 && this.resultadosLugar().length === 0,
  );

  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected digitar(valor: string): void {
    this.texto.set(valor);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.termo.set(valor.trim()), ATRASO_MS);
  }

  private limparCampo(): void {
    clearTimeout(this.temporizador);
    this.texto.set('');
    this.termo.set('');
  }

  protected abrirMunicipio(cd: string): void {
    this.limparCampo();
    this.estado.selecionarMunicipio(cd);
  }

  protected abrirLugar(l: LugarDTO): void {
    this.limparCampo();
    this.estado.irParaLugar(l);
  }
}

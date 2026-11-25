import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { categoria, faixaValida, type Faixa } from '@webgissus/domain';
import { classesLegenda } from '../../core/escala';
import { EstadoService, LIMITE_LISTA } from '../../core/estado.service';
import { ehTemaId, TEMAS } from '../../core/temas';
import { decimal, numero, numeroCompacto } from '../../shared/formatadores';

interface ClasseAtalho {
  cor: string;
  rotulo: string;
  faixa: Faixa;
}

/** Texto do número no campo (sem separador de milhar, para o <input type="number">). */
const paraCampo = (n: number | null): string => (n === null ? '' : String(n));

/**
 * Pesquisa por tipo de unidade (TP_UNIDADE do CNES) segundo um indicador do município
 * onde a unidade fica (ADR 0010). O critério é o mesmo tema que colore o mapa; a faixa é
 * livre ("a partir de" / "menos de") ou preenchida por uma classe da legenda.
 */
@Component({
  selector: 'app-pesquisa-tipo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="cartao" [open]="aberto()" (toggle)="aoAlternar($event)">
      <summary>
        <span>
          Pesquisar por tipo de unidade
          <small class="muted">Ex.: postos de saúde em municípios com densidade baixa</small>
        </span>
      </summary>

      <form class="corpo" (submit)="aplicar($event)" novalidate>
        <div class="ctrl">
          <label for="pq-tipo">Tipo de unidade (CNES)</label>
          <select id="pq-tipo" (change)="escolherTipo($any($event.target).value)" [disabled]="estado.tiposUnidade.carregando()">
            <option value="" [selected]="tipoSel() === null">
              {{ estado.tiposUnidade.carregando() ? 'Carregando tipos…' : 'Escolha o tipo' }}
            </option>
            @for (t of tipos(); track t.codigo) {
              <option [value]="t.codigo" [selected]="t.codigo === tipoSel()">{{ t.descricao }} ({{ num(t.total) }})</option>
            }
          </select>
          @if (estado.tiposUnidade.erro(); as e) {
            <span class="erro">{{ e }}</span>
          }
        </div>

        <div class="ctrl">
          <label for="pq-criterio">Critério: indicador do município da unidade</label>
          <select id="pq-criterio" (change)="escolherCriterio($any($event.target).value)">
            @for (t of temas; track t.id) {
              <option [value]="t.id" [selected]="t.id === tema().id">{{ t.titulo }}</option>
            }
          </select>
        </div>

        <fieldset class="faixa">
          <legend>Faixa do critério <span class="muted">({{ tema().unidade }})</span></legend>
          <div class="ctrl">
            <label for="pq-min">A partir de</label>
            <input id="pq-min" type="number" step="any" inputmode="decimal" placeholder="sem mínimo"
                   [value]="minTxt()" (input)="minTxt.set($any($event.target).value)" />
          </div>
          <div class="ctrl">
            <label for="pq-max">Menos de</label>
            <input id="pq-max" type="number" step="any" inputmode="decimal" placeholder="sem máximo"
                   [value]="maxTxt()" (input)="maxTxt.set($any($event.target).value)" />
          </div>
        </fieldset>

        @if (classes().length) {
          <div class="atalhos" role="group" aria-labelledby="pq-atalhos">
            <span id="pq-atalhos" class="muted rotulo-atalhos">Ou use uma classe da legenda:</span>
            @for (c of classes(); track c.rotulo) {
              <button type="button" class="chip" [class.ativa]="classeAtiva(c)" [attr.aria-pressed]="classeAtiva(c)" (click)="usarClasse(c)">
                <span class="amostra" [style.background]="c.cor" aria-hidden="true"></span>{{ c.rotulo }}
              </button>
            }
          </div>
        }

        @if (erro(); as e) {
          <p class="erro msg" role="alert">{{ e }}</p>
        }

        <div class="acoes">
          <button type="submit" class="btn">Pesquisar</button>
          @if (estado.pesquisaAtiva()) {
            <button type="button" class="btn sec" (click)="limpar()">Limpar pesquisa</button>
          }
        </div>
      </form>

      @if (estado.pesquisaAtiva()) {
        <section class="resultado" aria-live="polite" aria-labelledby="pq-resumo">
          @if (estado.pesquisa.carregando()) {
            <p class="muted" id="pq-resumo">Pesquisando…</p>
          } @else if (estado.pesquisa.erro(); as e) {
            <p class="erro" id="pq-resumo">{{ e }}</p>
            <button type="button" class="btn sec" (click)="estado.tentarNovamente()">Tentar novamente</button>
          } @else {
            <p id="pq-resumo" class="resumo-pq">
              <b>{{ num(resultado().length) }}</b> {{ resultado().length === 1 ? 'unidade' : 'unidades' }}
              de <b>{{ nomeTipo() }}</b> em {{ num(nMunicipios()) }} {{ nMunicipios() === 1 ? 'município' : 'municípios' }}
              {{ descricaoFaixa() }}
            </p>
            <ul class="lista">
              @for (f of primeiros(); track f.properties.cnes) {
                <li>
                  <button type="button" (click)="estado.abrirEstabelecimento(f.properties.cnes)">
                    <span class="sw" [style.background]="cor(f.properties.categoria)" aria-hidden="true"></span>
                    <span class="nome">{{ f.properties.nome }}</span>
                    <b>{{ valor(f.properties.valor) }}</b>
                    <span class="muted">{{ f.properties.municipio }}{{ f.properties.bairro ? ' · ' + f.properties.bairro : '' }}</span>
                  </button>
                </li>
              } @empty {
                <li class="muted vazio">Nenhuma unidade desse tipo atende ao critério. Tente ampliar a faixa.</li>
              }
            </ul>
            @if (resultado().length > primeiros().length) {
              <p class="muted nota">Mostrando {{ num(primeiros().length) }} na lista; todas as {{ num(resultado().length) }} estão no mapa.</p>
            }
            <p class="muted nota">
              O valor ao lado de cada unidade é o {{ tema().titulo.toLowerCase() }} do município. Municípios sem esse dado ficam de fora quando há faixa.
            </p>
          }
        </section>
      }
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
    details[open] summary::after { transform: rotate(-135deg); }
    .corpo { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem 0 0.875rem; border-top: 1px solid var(--borda); }
    .corpo .ctrl { margin: 0; }
    select, input { min-height: 44px; font: inherit; }
    .faixa { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0; padding: 0; border: 0; }
    .faixa legend { grid-column: 1 / -1; padding: 0; margin-bottom: 0.25rem; font-size: 0.8125rem; font-weight: 600; }
    .faixa .ctrl { margin: 0; }
    .faixa input { width: 100%; box-sizing: border-box; }
    .atalhos { display: flex; flex-wrap: wrap; gap: 6px; }
    .rotulo-atalhos { flex-basis: 100%; font-size: 0.75rem; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 10px;
      border: 1px solid var(--borda); border-radius: 18px; background: var(--superficie); color: var(--texto);
      font: inherit; font-size: 0.75rem; cursor: pointer;
    }
    .chip:hover { border-color: var(--borda-forte); }
    .chip.ativa { border-color: var(--primaria); box-shadow: inset 0 0 0 1px var(--primaria); font-weight: 600; }
    .amostra { width: 14px; height: 10px; border-radius: 2px; border: 1px solid #8a8a8a; flex: none; }
    .msg { margin: 0; font-size: 0.8125rem; }
    .acoes { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .acoes .btn { flex: 1; min-height: 44px; }
    .resultado { display: flex; flex-direction: column; gap: 0.5rem; padding: 0 0 0.875rem; }
    .resumo-pq { margin: 0; font-size: 0.875rem; }
    .lista b { font-variant-numeric: tabular-nums; }
    .vazio { padding: 0.5rem 0; }
    .nota { margin: 0; font-size: 0.75rem; }
  `,
})
export class PesquisaTipoComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly temas = TEMAS;
  protected readonly tema = this.estado.temaDef;
  protected readonly num = numero;

  private readonly rota = this.estado.rota;

  /** Começa aberto quando a URL já traz uma pesquisa. */
  protected readonly aberto = signal(this.rota().tipo !== null);

  // Campos do formulário: seguem a URL e podem ser editados antes de "Pesquisar".
  protected readonly tipoSel = linkedSignal(() => this.rota().tipo);
  protected readonly minTxt = linkedSignal(() => paraCampo(this.rota().min));
  protected readonly maxTxt = linkedSignal(() => paraCampo(this.rota().max));
  protected readonly erro = signal<string | null>(null);

  protected readonly tipos = computed(() => this.estado.tiposUnidade.dado() ?? []);
  protected readonly resultado = this.estado.resultadoPesquisa;
  protected readonly primeiros = computed(() => this.resultado().slice(0, LIMITE_LISTA));
  protected readonly nMunicipios = computed(() => new Set(this.resultado().map((f) => f.properties.cdMunicipio)).size);

  protected readonly nomeTipo = computed(() => {
    const t = this.rota().tipo;
    const d = this.tipos().find((x) => x.codigo === t)?.descricao;
    return (d ?? `tipo ${t}`).toLowerCase();
  });

  /** "com densidade demográfica de 10 a menos de 50 hab/km²", ou vazio sem faixa. */
  protected readonly descricaoFaixa = computed(() => {
    const { min, max } = this.rota();
    const t = this.tema();
    const f = (n: number) => numeroCompacto(n);
    const nome = t.titulo.toLowerCase();
    if (min !== null && max !== null) return `com ${nome} de ${f(min)} a menos de ${f(max)} ${t.unidade}`;
    if (min !== null) return `com ${nome} a partir de ${f(min)} ${t.unidade}`;
    if (max !== null) return `com ${nome} menor que ${f(max)} ${t.unidade}`;
    return '';
  });

  /** Classes da legenda (quintis sobre MG) como atalhos de faixa: "X a menos de Y". */
  protected readonly classes = computed<ClasseAtalho[]>(() => {
    const q = this.estado.quebras();
    return classesLegenda(q, this.tema().cores, numeroCompacto).map((c, i, todas) => ({
      ...c,
      faixa: { min: i === 0 ? null : q[i - 1], max: i === todas.length - 1 ? null : q[i] },
    }));
  });

  protected aoAlternar(e: Event): void {
    const aberto = (e.target as HTMLDetailsElement).open;
    this.aberto.set(aberto);
    if (aberto) this.estado.pesquisaAberta.set(true);
  }

  protected escolherTipo(v: string): void {
    this.tipoSel.set(v ? Number(v) : null);
    this.erro.set(null);
  }

  protected escolherCriterio(v: string): void {
    if (!ehTemaId(v)) return;
    // A faixa é de outro indicador: limpa os campos (a URL também perde min/max).
    this.minTxt.set('');
    this.maxTxt.set('');
    this.estado.definirTema(v);
  }

  protected classeAtiva(c: ClasseAtalho): boolean {
    const r = this.rota();
    return r.tipo !== null && r.min === c.faixa.min && r.max === c.faixa.max;
  }

  protected usarClasse(c: ClasseAtalho): void {
    this.minTxt.set(paraCampo(c.faixa.min));
    this.maxTxt.set(paraCampo(c.faixa.max));
    const tipo = this.tipoSel();
    if (tipo === null) {
      this.erro.set('Escolha o tipo de unidade para pesquisar.');
      return;
    }
    this.erro.set(null);
    this.estado.pesquisar(tipo, c.faixa.min, c.faixa.max);
  }

  protected aplicar(e: Event): void {
    e.preventDefault();
    const tipo = this.tipoSel();
    if (tipo === null) return this.erro.set('Escolha o tipo de unidade para pesquisar.');
    const min = this.lerCampo(this.minTxt());
    const max = this.lerCampo(this.maxTxt());
    if (Number.isNaN(min) || Number.isNaN(max)) return this.erro.set('Digite só números nos limites da faixa.');
    const faixa = { min, max };
    if (!faixaValida(faixa)) return this.erro.set('"A partir de" precisa ser menor que "Menos de".');
    this.erro.set(null);
    this.estado.pesquisar(tipo, faixa.min, faixa.max);
  }

  protected limpar(): void {
    this.erro.set(null);
    this.estado.limparPesquisa();
  }

  protected cor(slug: Parameters<typeof categoria>[0]): string {
    return categoria(slug).cor;
  }

  protected valor(v: number | null): string {
    const t = this.tema();
    return v === null ? 'sem dado' : t.casas ? decimal(v, t.casas) : numero(v);
  }

  /** '' → null; texto não numérico → NaN. */
  private lerCampo(txt: string): number | null {
    const s = txt.trim().replace(',', '.');
    return s === '' ? null : Number(s);
  }
}

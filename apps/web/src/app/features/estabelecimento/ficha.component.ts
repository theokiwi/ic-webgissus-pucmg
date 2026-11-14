import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { categoria, dataLocal, rotuloCategoria, situacaoFuncionamento, type EstabelecimentoDTO } from '@webgissus/domain';
import { EstadoService } from '../../core/estado.service';
import { competenciaIso, enderecoLinhas, NOMES_DIA, ORDEM_DIAS, telefone, telefoneDigitos } from '../../shared/formatadores';
import { descreverMudanca, rotuloSituacao } from '../../shared/situacao';

const NATUREZA: Record<EstabelecimentoDTO['natureza'], string> = {
  publica: 'Pública',
  empresarial: 'Empresarial (privada)',
  sem_fins_lucrativos: 'Sem fins lucrativos',
  pessoa_fisica: 'Pessoa física',
  nao_informada: 'Natureza não informada',
};

@Component({
  selector: 'app-ficha',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="topo">
      <button type="button" class="btn sec" (click)="estado.fecharFicha()">&larr; Fechar ficha</button>
    </div>

    <div aria-live="polite">
      @if (ficha.carregando()) {
        <p class="muted">Carregando ficha…</p>
      }
    </div>
    @if (ficha.erro(); as e) {
      <p class="erro" role="alert">{{ e }}</p>
    }

    @if (d(); as f) {
      <h2 #titulo tabindex="-1" class="nome-ficha">{{ f.nome }}</h2>
      <p class="cat">
        <span class="sw" [style.background]="cor()" aria-hidden="true"></span>
        {{ rotulo() }} · {{ f.tipoUnidade.descricao }}
      </p>

      <p class="situacao" [attr.data-estado]="situacao().estado" role="status">
        <b>{{ rotuloSituacao(situacao()) }}</b>
        @if (mudanca()) {
          <span> · {{ mudanca() }}</span>
        }
      </p>

      @if (!f.coordOk) {
        <p class="aviso-loc" role="note">Localização pode estar imprecisa.</p>
      }

      <section aria-labelledby="h-end">
        <h3 id="h-end">Endereço</h3>
        <address>
          @for (l of endereco(); track l) {
            {{ l }}<br />
          }
          {{ f.municipio.nome }} - MG
        </address>
        @if (tel(); as t) {
          <p>
            Telefone: <a class="tel" [href]="'tel:' + t.digitos">{{ t.texto }}</a>
          </p>
        }
        <p class="muted">{{ natureza() }}</p>
      </section>

      <section aria-labelledby="h-hor">
        <h3 id="h-hor">Horários</h3>
        @if (f.sempreAberto) {
          <p>Atendimento 24 horas, todos os dias.</p>
        } @else if (f.horarios.length === 0) {
          <p class="muted">Horário não informado.</p>
        } @else {
          <table class="horarios">
            <tbody>
              @for (dia of dias(); track dia.nome) {
                <tr [class.hoje]="dia.hoje">
                  <th scope="row">{{ dia.nome }}</th>
                  <td>{{ dia.texto }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (f.turno) {
          <p class="muted">Turno: {{ f.turno }}</p>
        }
      </section>

      @if (f.servicos.length) {
        <section aria-labelledby="h-serv">
          <h3 id="h-serv">Serviços</h3>
          <ul class="servicos">
            @for (s of f.servicos; track s.servico + s.classificacao) {
              <li>
                {{ s.servico }}@if (s.classificacao) {
                  <span class="muted"> — {{ s.classificacao }}</span>
                }
                @if (s.sus) {
                  <span class="selo-sus">SUS</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      @if (f.atendimentos.length) {
        <section aria-labelledby="h-atend">
          <h3 id="h-atend">Tipos de atendimento</h3>
          <ul class="servicos">
            @for (a of f.atendimentos; track a.atendimento) {
              <li>
                {{ a.atendimento }}
                @if (a.sus) {
                  <span class="selo-sus">SUS</span>
                }
              </li>
            }
          </ul>
        </section>
      }

      <p class="aviso" role="note">
        Informações do CNES (competência {{ competencia() }}). Confirme por telefone antes de ir. Em emergência, ligue 192
        (SAMU).
      </p>
    }
  `,
  styles: `
    .topo { margin-bottom: 0.5rem; }
    .nome-ficha { margin: 0.25rem 0; font-size: 1.1875rem; outline: none; }
    .cat { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.5rem; font-size: 0.875rem; }
    .situacao { margin: 0.25rem 0 0.75rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: var(--destaque); border-left: 5px solid var(--borda-forte); }
    .situacao[data-estado='aberto'], .situacao[data-estado='24h'] { border-left-color: #1b5e20; }
    .situacao[data-estado='fechado'] { border-left-color: #b71c1c; }
    .aviso-loc { background: #fff3cd; color: #5f4300; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.875rem; }
    h3 { font-size: 0.9375rem; margin: 1rem 0 0.25rem; }
    address { font-style: normal; }
    .tel { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
    .horarios { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
    .horarios th { text-align: left; font-weight: 400; padding: 3px 8px 3px 0; white-space: nowrap; }
    .horarios tr.hoje { font-weight: 700; }
    .servicos { margin: 0; padding-left: 1.1rem; font-size: 0.875rem; }
    .selo-sus { background: #1b5e20; color: #fff; border-radius: 4px; padding: 0 5px; font-size: 0.6875rem; font-weight: 700; margin-left: 4px; }
    .aviso { margin-top: 1rem; padding: 0.625rem 0.75rem; border-radius: 8px; background: var(--destaque); font-size: 0.8125rem; }
  `,
})
export class FichaComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly ficha = this.estado.ficha;
  protected readonly d = this.ficha.dado;
  protected readonly rotuloSituacao = rotuloSituacao;

  private readonly agora = signal(new Date());
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  protected readonly situacao = computed(() => {
    const f = this.d();
    return situacaoFuncionamento(f?.horarios ?? [], f?.sempreAberto ?? false, this.agora());
  });
  protected readonly mudanca = computed(() => descreverMudanca(this.situacao(), this.agora()));
  protected readonly cor = computed(() => (this.d() ? categoria(this.d()!.categoria).cor : '#555'));
  protected readonly rotulo = computed(() => (this.d() ? rotuloCategoria(this.d()!.categoria) : ''));
  protected readonly endereco = computed(() => (this.d() ? enderecoLinhas(this.d()!.endereco) : []));
  protected readonly natureza = computed(() => (this.d() ? NATUREZA[this.d()!.natureza] : ''));
  protected readonly competencia = computed(() => competenciaIso(this.d()?.competencia ?? ''));
  protected readonly tel = computed(() => {
    const digitos = telefoneDigitos(this.d()?.telefone);
    return digitos ? { digitos, texto: telefone(this.d()?.telefone) } : null;
  });

  protected readonly dias = computed(() => {
    const hoje = dataLocal(this.agora()).dia;
    const hs = this.d()?.horarios ?? [];
    return ORDEM_DIAS.map((dia) => {
      const faixas = hs
        .filter((h) => h.dia === dia)
        .sort((a, b) => a.abre.localeCompare(b.abre))
        .map((h) => `${h.abre.slice(0, 5)}–${h.fecha.slice(0, 5)}`);
      return { nome: NOMES_DIA[dia], texto: faixas.length ? faixas.join(' e ') : 'Sem atendimento', hoje: dia === hoje };
    });
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const navegador = isPlatformBrowser(inject(PLATFORM_ID));
    afterNextRender(() => {
      if (!navegador) return;
      // Mantém "aberto agora" atualizado se a ficha ficar aberta.
      const t = setInterval(() => this.agora.set(new Date()), 60_000);
      destroyRef.onDestroy(() => clearInterval(t));
    });
    // Leitores de tela: leva o foco ao nome quando a ficha carrega.
    effect(() => {
      if (this.d()) this.titulo()?.nativeElement.focus({ preventScroll: true });
    });
  }
}

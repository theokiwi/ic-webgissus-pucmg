import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { competenciaPorExtenso, urlFichaCnes } from '@webgissus/domain';
import { dataBr } from './formatadores';

/**
 * Selo de transparência da ficha (ADR 0009): de onde vêm os dados e quando foram atualizados,
 * para que o cidadão saiba o quanto confiar no horário e nos serviços antes de sair de casa.
 */
@Component({
  selector: 'app-selo-transparencia',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="selo">
      <summary>
        <span class="icone" aria-hidden="true">✓</span>
        <span>Fonte oficial: <b>CNES/DATASUS</b> · dados de {{ mes() }}</span>
      </summary>
      <dl>
        <div>
          <dt>Fonte</dt>
          <dd>Cadastro Nacional de Estabelecimentos de Saúde (CNES), Ministério da Saúde</dd>
        </div>
        <div>
          <dt>Competência</dt>
          <dd>{{ mes() }}</dd>
        </div>
        <div>
          <dt>Cadastro atualizado pela unidade em</dt>
          <dd>{{ atualizado() || 'não informado' }}</dd>
        </div>
        @if (publicado()) {
          <div>
            <dt>Publicado neste mapa em</dt>
            <dd>{{ publicado() }}</dd>
          </div>
        }
      </dl>
      <p class="nota">
        Horários e serviços são informados pela própria unidade ao CNES e podem mudar sem aviso. Confirme por telefone antes
        de ir. Em emergência, ligue 192 (SAMU).
      </p>
      @if (link(); as l) {
        <a class="oficial" [href]="l" target="_blank" rel="noopener noreferrer">
          Ver a ficha oficial no CNES<span class="sr"> (abre em nova aba)</span> ↗
        </a>
      }
    </details>
  `,
  styles: `
    :host { display: block; margin: 1rem 0 0; }
    .selo { border: 1px solid var(--borda); border-radius: 10px; background: var(--destaque); font-size: 0.8125rem; }
    summary {
      display: flex; align-items: center; gap: 0.5rem; min-height: 44px; padding: 0 0.75rem;
      cursor: pointer; list-style-position: outside;
    }
    .icone {
      flex: none; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
      border-radius: 50%; background: #1b5e20; color: #fff; font-size: 0.75rem; font-weight: 700;
    }
    dl { margin: 0; padding: 0 0.75rem; }
    dl div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 0.75rem; padding: 0.375rem 0; border-top: 1px solid var(--borda); }
    dt { color: var(--texto-suave); }
    dd { margin: 0; font-weight: 600; }
    .nota { margin: 0; padding: 0.5rem 0.75rem; border-top: 1px solid var(--borda); }
    .oficial { display: flex; align-items: center; min-height: 44px; padding: 0 0.75rem; border-top: 1px solid var(--borda); font-weight: 600; color: #0d47a1; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  `,
})
export class SeloTransparenciaComponent {
  /** 'AAAAMM'. */
  readonly competencia = input.required<string>();
  /** Última atualização do cadastro pela unidade ('AAAA-MM-DD'). */
  readonly atualizadoEm = input<string | null>(null);
  /** CO_UNIDADE (13 dígitos), para o link oficial. */
  readonly codigoUnidade = input<string>('');
  /** Quando a carga foi publicada no mapa (ISO de `/api/meta`). */
  readonly publicadoEm = input<string | null>(null);

  protected readonly mes = computed(() => competenciaPorExtenso(this.competencia()));
  protected readonly atualizado = computed(() => dataBr(this.atualizadoEm()));
  protected readonly publicado = computed(() => dataBr(this.publicadoEm()));
  protected readonly link = computed(() => urlFichaCnes(this.codigoUnidade()));
}

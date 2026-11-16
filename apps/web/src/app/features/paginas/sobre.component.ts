import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { carregar } from '../../core/carregar';
import { PaginaComponent } from '../../shared/pagina.component';
import { competenciaIso, numero } from '../../shared/formatadores';

/** Atalhos para municípios grandes (códigos IBGE de 7 dígitos). */
const ATALHOS = [
  { cd: '3106200', nome: 'Belo Horizonte' },
  { cd: '3170206', nome: 'Uberlândia' },
  { cd: '3118601', nome: 'Contagem' },
  { cd: '3136702', nome: 'Juiz de Fora' },
  { cd: '3143302', nome: 'Montes Claros' },
  { cd: '3170107', nome: 'Uberaba' },
];

@Component({
  selector: 'app-sobre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PaginaComponent, RouterLink],
  template: `
    <app-pagina>
      <section class="hero" aria-labelledby="t-hero">
        <div class="in">
          <p class="kicker">Saúde gratuita pelo SUS · Minas Gerais</p>
          <h1 id="t-hero">Onde ser atendido pelo SUS, perto de você</h1>
          <p class="lead">
            Mapa dos estabelecimentos de saúde que atendem gratuitamente pelo SUS em Minas Gerais, com indicadores por
            município, horários, rotas e a opção de compartilhar o que você encontrou.
          </p>
          <div class="cta">
            <a class="botao p" routerLink="/">Abrir o mapa</a>
            <a class="botao s" routerLink="/perto">Estabelecimentos perto de mim</a>
          </div>
        </div>
      </section>

      <section class="numeros" aria-label="Números principais">
        @if (meta.dado(); as m) {
          <div class="num"><b>{{ n(m.totais.estabelecimentos) }}</b><span>estabelecimentos que atendem pelo SUS</span></div>
          <div class="num"><b>{{ n(m.totais.municipios) }}</b><span>municípios de Minas Gerais</span></div>
          <div class="num"><b>{{ n(m.totais.populacao) }}</b><span>habitantes (Censo 2022, IBGE)</span></div>
          <div class="num"><b>{{ comp(m.competencia) }}</b><span>competência do CNES exibida no mapa</span></div>
        }
      </section>

      <div class="conteudo">
        <section aria-labelledby="t-oque">
          <h2 id="t-oque">O que é</h2>
          <p>
            O WebGIS SUS-MG reúne em um só mapa os serviços de saúde que o cidadão pode procurar sem pagar nada, pelo
            Sistema Único de Saúde: unidades básicas, UPAs e pronto-socorros, hospitais, laboratórios, centros de saúde
            mental (CAPS), farmácias, vacinação, hemocentros e academias da saúde. Funciona no computador e no celular e
            pode ser instalado como aplicativo (PWA) a partir do navegador.
          </p>
          <ul class="cards">
            <li><h3>Mapa por município</h3><p>Indicadores de população, densidade e estabelecimentos por 10 mil habitantes, em todo o estado.</p></li>
            <li><h3>Ficha do estabelecimento</h3><p>Endereço, telefone, horários e serviços, com a situação “aberto agora” quando o horário é conhecido.</p></li>
            <li><h3>Perto de mim e rotas</h3><p>Os mais próximos da sua posição e o caminho de carro, a pé ou de bicicleta.</p></li>
          </ul>
          <p class="chips"><span>Experimente:</span>
            @for (a of atalhos; track a.cd) {
              <a class="chip" [routerLink]="['/municipio', a.cd]">{{ a.nome }}</a>
            }
          </p>
        </section>

        <section aria-labelledby="t-fontes">
          <h2 id="t-fontes">De onde vêm os dados</h2>
          <ul>
            <li><b>Estabelecimentos:</b> CNES (Cadastro Nacional de Estabelecimentos de Saúde), do DATASUS/Ministério da Saúde, versionado pela competência mensal (AAAAMM) — a competência vigente aparece nos números acima e em cada ficha.</li>
            <li><b>Territórios de saúde:</b> macrorregiões e regiões de saúde da base territorial do DATASUS.</li>
            <li><b>Municípios, malha e população:</b> IBGE (Censo 2022).</li>
            <li><b>Mapa base:</b> © colaboradores do OpenStreetMap, servido pelo OpenFreeMap.</li>
            <li><b>Busca de bairros e endereços:</b> Photon (komoot), sobre dados do OpenStreetMap.</li>
            <li><b>Rotas:</b> Valhalla, motor de roteamento de código aberto, sobre dados do OpenStreetMap.</li>
          </ul>
        </section>

        <section aria-labelledby="t-selecao">
          <h2 id="t-selecao">Como os estabelecimentos foram selecionados</h2>
          <p>Entra no mapa um estabelecimento que cumpra, ao mesmo tempo, três condições (ADR 0003 do projeto):</p>
          <ol>
            <li>está <b>ativo</b> no CNES (sem motivo de desativação);</li>
            <li><b>atende pelo SUS</b> (convênio SUS registrado no CNES) — inclui unidades públicas, filantrópicas e privadas conveniadas;</li>
            <li>é de um <b>tipo de unidade que o cidadão visita</b>. Ficam de fora, por exemplo, unidades móveis, telessaúde, centrais de regulação, vigilância, gestão e equipes de apoio.</li>
          </ol>
          <p>
            Os estabelecimentos são agrupados em dez categorias (atenção básica, urgência, hospital, laboratório,
            especialidades, saúde mental, farmácia, vacinação, hemocentro e promoção da saúde). O município considerado é
            o de <b>localização</b> da unidade, e não o do gestor.
          </p>
        </section>

        <section aria-labelledby="t-limites">
          <h2 id="t-limites">Limitações</h2>
          <ul>
            <li>Horários e coordenadas vêm do cadastro do CNES, preenchido pelos próprios estabelecimentos, e <b>podem estar desatualizados</b>. Ligue antes de ir.</li>
            <li>Unidades 24 horas são identificadas por um campo próprio do CNES; as demais dependem do horário cadastrado, que às vezes está ausente.</li>
            <li>Uma pequena parte das coordenadas cai fora do município da unidade; esses casos recebem aviso de localização imprecisa na ficha.</li>
            <li>As rotas são estimativas por velocidade de via, sem trânsito em tempo real e sem transporte público; o OpenStreetMap pode ter lacunas em áreas rurais.</li>
            <li>Este mapa não substitui a orientação de profissionais de saúde nem indica qual serviço você deve procurar.</li>
          </ul>
        </section>

        <p class="nota" role="note">
          <b>Em emergência, ligue 192 (SAMU)</b> ou procure o pronto atendimento mais próximo. Não use este mapa para decidir
          sobre atendimento urgente.
        </p>

        <section aria-labelledby="t-creditos">
          <h2 id="t-creditos">Créditos</h2>
          <p>
            Projeto de Iniciação Científica com apoio da FAPEMIG, sobre geoprocessamento aplicado à saúde pública e ao uso
            de IA no desenvolvimento de software. O código e as decisões de projeto estão documentados no repositório.
            Veja também a <a routerLink="/privacidade">política de privacidade</a>.
          </p>
        </section>
      </div>
    </app-pagina>
  `,
  styles: `
    .in, .conteudo { max-width: 1040px; margin: 0 auto; padding: 0 1rem; }
    .hero { background: linear-gradient(135deg, #0d47a1, #1565c0 60%, #2e7d32); color: #fff; padding: 2.5rem 0 4rem; }
    .kicker { font-size: 0.8125rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; margin: 0 0 0.5rem; }
    h1 { font-size: clamp(1.75rem, 5vw, 3rem); line-height: 1.1; margin: 0 0 1rem; max-width: 22ch; }
    .lead { font-size: clamp(1rem, 2.2vw, 1.25rem); max-width: 60ch; margin: 0 0 1.5rem; }
    .cta { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .botao { display: inline-flex; align-items: center; min-height: 48px; padding: 0 1.25rem; border-radius: 8px; font-weight: 700; text-decoration: none; }
    .botao.p { background: #fff; color: #0d47a1; }
    .botao.s { border: 2px solid #fff; color: #fff; }
    .numeros { max-width: 1040px; margin: -2rem auto 0; padding: 0 1rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; position: relative; min-height: 4rem; }
    .num { background: #fff; border-radius: 12px; padding: 1rem; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1); }
    .num b { display: block; font-size: 1.75rem; line-height: 1.1; color: var(--primaria); }
    .num span { display: block; margin-top: 0.25rem; font-size: 0.8125rem; color: var(--texto-suave); }
    h2 { font-size: 1.5rem; margin: 2.5rem 0 0.5rem; }
    h3 { font-size: 1.0625rem; margin: 0 0 0.25rem; }
    .conteudo { line-height: 1.6; font-size: 1.0625rem; padding-bottom: 1rem; }
    .conteudo p, .conteudo li { max-width: 72ch; }
    .cards { list-style: none; padding: 0; margin: 1rem 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    .cards li { background: #fff; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.07); }
    .cards p { margin: 0; font-size: 0.9375rem; color: var(--texto-suave); }
    .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; font-size: 0.9375rem; }
    .chips span { font-weight: 600; color: var(--texto-suave); }
    .chip { display: inline-flex; align-items: center; min-height: 44px; padding: 0 0.875rem; border: 1px solid var(--primaria); border-radius: 999px; background: var(--destaque); color: #0d47a1; text-decoration: none; font-weight: 600; }
    .nota { background: #fff3cd; color: #4d3800; border-left: 5px solid #b58100; padding: 1rem 1.25rem; border-radius: 8px; margin: 2rem 0 0; }
    a { color: #0d47a1; }
    @media (max-width: 820px) { .numeros { grid-template-columns: 1fr 1fr; } .cards { grid-template-columns: 1fr; } }
  `,
})
export class SobreComponent {
  private readonly api = inject(ApiService);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly atalhos = ATALHOS;
  /** Números ao vivo só no navegador: a página é prerenderizada sem acesso à API. */
  protected readonly meta = carregar(signal(this.navegador ? 1 : null), () => this.api.meta());
  protected readonly n = numero;
  protected readonly comp = competenciaIso;
}

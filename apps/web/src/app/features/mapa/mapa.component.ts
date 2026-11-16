import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { EstadoService } from '../../core/estado.service';
import { ZOOM_MINIMO_SETORES } from '../../core/setores';
import { BottomSheetComponent, type TamanhoFolha } from '../../shared/bottom-sheet.component';
import { TelaService } from '../../shared/tela.service';
import { FichaComponent } from '../estabelecimento/ficha.component';
import { PainelMunicipioComponent } from '../municipio/painel-municipio.component';
import { PainelPertoComponent } from '../perto/painel-perto.component';
import { MapaController, type Folgas } from './mapa-controller';
import { PainelMgComponent } from './painel-mg.component';

@Component({
  selector: 'app-mapa',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BottomSheetComponent, PainelMgComponent, PainelMunicipioComponent, PainelPertoComponent, FichaComponent],
  template: `
    <div class="canvas" #canvas role="application" aria-label="Mapa dos estabelecimentos de saúde do SUS em Minas Gerais"></div>

    @if (!(tela.pequena() && fichaAberta())) {
      <app-bottom-sheet rotulo="de navegação" [(tamanho)]="tamanhoPainel">
        @if (emPerto()) {
          <app-painel-perto />
        } @else if (emMunicipio()) {
          <app-painel-municipio />
        } @else {
          <app-painel-mg />
        }
      </app-bottom-sheet>
    }

    @if (fichaAberta()) {
      <app-bottom-sheet rotulo="do estabelecimento" lado="direita" [(tamanho)]="tamanhoFicha">
        <app-ficha />
      </app-bottom-sheet>
    }

    @if (loc.escolhendo()) {
      <div class="barra-escolha" role="region" aria-label="Escolher ponto no mapa">
        @if (loc.pontoTocado()) {
          <span>Ponto marcado no mapa.</span>
          <button type="button" class="btn" (click)="estado.confirmarPontoTocado()">Usar este ponto</button>
        } @else {
          <span>Toque no mapa para escolher o ponto.</span>
        }
        <button type="button" class="btn sec" (click)="loc.cancelarEscolha()">Cancelar</button>
      </div>
    }

    <div class="carregando" aria-live="polite" role="status">
      @if (estado.carregandoGeral() || iniciando()) {
        <div class="overlay"><span class="giro" aria-hidden="true"></span> Carregando…</div>
      }
    </div>

    @if (estado.erroGeral() ?? erroMapa(); as msg) {
      <div class="faixa-erro" role="alert">
        <span>{{ msg }}</span>
        @if (estado.erroGeral()) {
          <button type="button" class="btn" (click)="estado.tentarNovamente()">Tentar novamente</button>
        }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: block; width: 100%; height: 100dvh; overflow: hidden; }
    .canvas { position: absolute; inset: 0; }
    .overlay {
      position: absolute; z-index: 10; top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
      background: var(--superficie); color: var(--texto); border-radius: 24px; box-shadow: 0 2px 10px rgba(0,0,0,.3);
    }
    .giro { width: 16px; height: 16px; border: 3px solid var(--borda-forte); border-top-color: var(--primaria); border-radius: 50%; animation: gira 0.8s linear infinite; }
    @keyframes gira { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .giro { animation-duration: 3s; } }
    .barra-escolha {
      position: absolute; z-index: 12; top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.5rem;
      max-width: min(92vw, 560px); padding: 0.5rem 0.75rem; border-radius: 12px;
      background: var(--superficie); color: var(--texto); box-shadow: 0 2px 12px rgba(0,0,0,.35);
    }
    @media (max-width: 600px) { .barra-escolha { left: 12px; right: 64px; transform: none; max-width: none; } }
    .faixa-erro {
      position: absolute; z-index: 11; left: 50%; bottom: 16px; transform: translateX(-50%);
      max-width: min(92vw, 520px); display: flex; gap: 0.75rem; align-items: center;
      background: #7f1d1d; color: #fff; padding: 0.625rem 1rem; border-radius: 10px;
    }
    @media (max-width: 600px) { .faixa-erro { bottom: auto; top: 12px; } .overlay { top: 60px; } }
  `,
})
export class MapaComponent {
  protected readonly estado = inject(EstadoService);
  protected readonly tela = inject(TelaService);
  protected readonly loc = this.estado.localizacao;

  private readonly canvas = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly controller = signal<MapaController | null>(null);
  private readonly pronto = signal(false);
  protected readonly iniciando = signal(false);
  protected readonly erroMapa = signal<string | null>(null);

  protected readonly tamanhoPainel = signal<TamanhoFolha>('meio');
  protected readonly tamanhoFicha = signal<TamanhoFolha>('meio');

  protected readonly fichaAberta = computed(() => this.estado.rota().visao === 'estabelecimento');
  protected readonly emPerto = computed(() => this.estado.rota().visao === 'perto');
  protected readonly emMunicipio = computed(() => this.estado.cdMunicipio() !== null);
  private readonly coordenadasRota = computed(() =>
    this.estado.rota().visao === 'estabelecimento' ? (this.estado.rotaCalculada.dado()?.geometria.coordinates ?? null) : null,
  );
  private readonly chaveAlvo = computed(() => this.estado.alvo().chave);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(async () => {
      this.iniciando.set(true);
      try {
        const c = await MapaController.criar(this.canvas().nativeElement, {
          verEstabelecimentos: (cd) => this.estado.selecionarMunicipio(cd),
          abrirEstabelecimento: (cnes) => this.estado.abrirEstabelecimento(cnes),
          pertoDeMim: () => void this.estado.pertoDeMim(),
          pontoTocado: (lat, lon) => this.loc.pontoTocado.set({ lat, lon }),
          zoomMudou: (z) => this.estado.zoomMapa.set(Math.round(z * 2) / 2),
          pronto: () => {
            this.pronto.set(true);
            this.iniciando.set(false);
          },
        });
        destroyRef.onDestroy(() => c.destruir());
        this.controller.set(c);
      } catch {
        this.erroMapa.set('Não foi possível iniciar o mapa. Verifique se o seu navegador tem WebGL ativado e recarregue a página.');
        this.iniciando.set(false);
      }
    });

    const comMapa = () => (this.pronto() ? this.controller() : null);

    effect(() => {
      const c = comMapa();
      if (c) c.aplicarTema(this.estado.temaDef(), this.estado.quebras());
    });
    effect(() => {
      const c = comMapa();
      if (c) c.definirMunicipio(this.estado.cdMunicipio());
    });
    effect(() => {
      const c = comMapa();
      if (c) c.definirPontos(this.estado.pontosVisiveis());
    });
    effect(() => {
      const c = comMapa();
      const r = this.estado.rota();
      if (c) c.definirSelecionado(r.visao === 'estabelecimento' ? r.cnes : null);
    });
    effect(() => {
      const c = comMapa();
      if (c) c.definirPertoAtivo(this.emPerto());
    });
    effect(() => {
      const c = comMapa();
      if (c) c.definirSetores(this.estado.rota().setores);
    });
    effect(() => {
      const c = comMapa();
      const pedido = this.estado.pedidoZoomSetores();
      if (c && pedido > 0) untracked(() => c.aproximarAte(ZOOM_MINIMO_SETORES, this.folgas(false)));
    });
    effect(() => {
      const c = comMapa();
      const escolhendo = this.loc.escolhendo() !== null;
      if (c) c.definirEscolha(escolhendo);
      if (escolhendo && untracked(() => this.tela.pequena())) this.tamanhoPainel.set('recolhido');
    });
    effect(() => {
      const c = comMapa();
      if (c) c.definirToque(this.loc.pontoTocado());
    });
    effect(() => {
      const c = comMapa();
      const r = this.estado.rota();
      if (c) c.definirUsuario(r.visao === 'perto' ? r.ponto : r.visao === 'estabelecimento' ? r.de : null);
    });
    effect(() => {
      const c = comMapa();
      const perto = this.emPerto() ? this.estado.perto.dado() : null;
      if (c) c.definirPerto(perto ?? []);
    });
    effect(() => {
      const c = comMapa();
      const perto = this.emPerto() ? this.estado.perto.dado() : null;
      const ponto = untracked(() => this.estado.rota().ponto);
      if (!c || !perto || !ponto) return;
      const coords: [number, number][] = [[ponto.lon, ponto.lat], ...perto.map((p): [number, number] => [p.lon, p.lat])];
      untracked(() => c.enquadrarPontos(coords, this.folgas(false), 14));
    });
    effect(() => {
      const c = comMapa();
      const coords = this.coordenadasRota();
      if (!c) return;
      c.definirRota(coords);
      if (coords) untracked(() => c.enquadrarPontos(coords, this.folgas(true), 17));
    });
    effect(() => {
      const c = comMapa();
      const chave = this.chaveAlvo();
      if (!c || chave === 'pendente' || chave === 'estabelecimento') return;
      untracked(() => c.enquadrar(this.estado.alvo().bbox, this.folgas(false)));
    });
    effect(() => {
      const c = comMapa();
      const f = this.estado.ficha.dado();
      // Com rota desenhada, quem enquadra é o efeito da rota (evita brigar por a câmera).
      if (c && f) untracked(() => this.coordenadasRota() ?? c.focar(f.lon, f.lat, this.folgas(true)));
    });
  }

  /** Margens do enquadramento para não deixar o alvo atrás do painel. */
  private folgas(comFicha: boolean): Folgas {
    const base = 24;
    if (this.tela.pequena()) {
      return { top: base, right: base, left: base, bottom: Math.round(window.innerHeight * 0.45) + 10 };
    }
    return { top: base, bottom: base, left: 12 + 380 + base, right: comFicha || this.fichaAberta() ? 12 + 360 + base : base };
  }
}

import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, linkedSignal, PLATFORM_ID, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import type { BBox, CategoriaSlug, LugarDTO, MacrorregiaoDTO, ModoRota, MunicipioResumoDTO, ProximoDTO } from '@webgissus/domain';
import { normalizar } from '../shared/formatadores';
import { ApiService } from './api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { carregar, mensagemDeErro } from './carregar';
import { calcularQuebras } from './escala';
import { arredondarCoord, montarUrl, parseRota, type EstadoRota, type Ponto } from './estado-url';
import type { PontoFeature } from './geojson';
import { LocalizacaoService } from './localizacao.service';
import { temaPorId, valorTema, type TemaId } from './temas';

/** Caixa envolvente aproximada de Minas Gerais. */
export const BBOX_MG: BBox = [-51.05, -22.93, -39.85, -14.22];

export const LIMITE_LISTA = 100;

/** Mensagem exibida quando a API de rotas responde 503 (Valhalla fora do ar ou sem trajeto). */
export const MSG_ROTA_INDISPONIVEL =
  'O cálculo de rotas está indisponível no momento. Você ainda pode abrir o destino no app de mapas.';

export function mensagemDeErroRota(e: unknown): string {
  if (e instanceof HttpErrorResponse && (e.status === 503 || e.status === 504 || e.status === 0)) return MSG_ROTA_INDISPONIVEL;
  return mensagemDeErro(e);
}

const iguais = <T>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

const ARREDONDA = (p: Ponto): Ponto => ({ lat: arredondarCoord(p.lat), lon: arredondarCoord(p.lon) });

export interface Selecao {
  macro: string | null;
  regiao: string | null;
  municipio: string | null;
}

/**
 * Estado da aplicação: a URL é a fonte da verdade (`rota`); os dados vêm da API
 * e tudo o mais é derivado em `computed`.
 */
@Injectable({ providedIn: 'root' })
export class EstadoService {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  readonly localizacao = inject(LocalizacaoService);
  /** Zoom atual do mapa (alimentado pelo controlador); decide se os setores já aparecem. */
  readonly zoomMapa = signal(0);
  /** URL de onde a ficha foi aberta, quando veio de "Perto de mim" (para o botão voltar). */
  private voltarPara: string | null = null;

  readonly rota = signal<EstadoRota>(parseRota(this.router.url));
  private readonly tentativa = signal(1);

  // --- dados globais (carregados só no navegador) ---
  private readonly chaveGlobal = computed(() => (this.navegador ? this.tentativa() : null));
  readonly meta = carregar(this.chaveGlobal, () => this.api.meta());
  readonly regioes = carregar(this.chaveGlobal, () => this.api.regioes());
  readonly municipios = carregar(this.chaveGlobal, () => this.api.municipios());

  // --- ficha e município atual ---
  readonly cnes = computed(() => (this.navegador && this.rota().visao === 'estabelecimento' ? this.rota().cnes : null));
  readonly ficha = carregar(this.cnes, (c) => this.api.estabelecimento(c));

  /** Município exibido com pontos: o da rota, ou o do estabelecimento aberto (mantém o anterior enquanto a ficha carrega). */
  readonly cdMunicipio = linkedSignal<{ r: EstadoRota; f: string | null }, string | null>({
    source: () => ({ r: this.rota(), f: this.ficha.dado()?.municipio.cd ?? null }),
    computation: ({ r, f }, anterior) => {
      if (!this.navegador) return null;
      if (r.visao === 'municipio') return r.cd;
      if (r.visao === 'estabelecimento') return f ?? anterior?.value ?? null;
      return null;
    },
  });
  readonly municipio = carregar(this.cdMunicipio, (cd) => this.api.municipio(cd));
  readonly pontos = carregar(this.cdMunicipio, (cd) => this.api.estabelecimentosDoMunicipio(cd));

  // --- perto de mim ---
  private readonly chavePerto = computed(
    () => {
      const r = this.rota();
      if (!this.navegador || r.visao !== 'perto' || !r.ponto) return null;
      return { ...r.ponto, cat: r.cat, raio: r.raio, tentativa: this.tentativa() };
    },
    { equal: iguais },
  );
  readonly perto = carregar(this.chavePerto, (k) =>
    this.api.proximos(k.lat, k.lon, { categoria: k.cat, limite: 20, raioKm: k.raio }),
  );

  // --- rota até o estabelecimento da ficha ---
  /** O servidor desenha rotas (Valhalla)? Sem isso, "Como chegar" oferece só os links externos. */
  readonly rotasDisponiveis = computed(() => this.meta.dado()?.rotas === true);
  private readonly chaveRota = computed(
    () => {
      const r = this.rota();
      const f = this.ficha.dado();
      if (!this.navegador || !this.rotasDisponiveis() || r.visao !== 'estabelecimento' || !r.modoRota || !r.de || !f) return null;
      return { modo: r.modoRota, de: r.de, para: { lat: f.lat, lon: f.lon }, tentativa: this.tentativa() };
    },
    { equal: iguais },
  );
  readonly rotaCalculada = carregar(this.chaveRota, (k) => this.api.rota(k.de, k.para, k.modo), mensagemDeErroRota);

  // --- derivados ---
  readonly tema = computed(() => this.rota().tema);
  readonly temaDef = computed(() => temaPorId(this.tema()));
  readonly listaMunicipios = computed<MunicipioResumoDTO[]>(() => this.municipios.dado() ?? []);

  /** Quebras da escala do tema, calculadas sobre todos os municípios de MG. */
  readonly quebras = computed(() => {
    const t = this.tema();
    return calcularQuebras(this.listaMunicipios().map((m) => valorTema(m, t)));
  });

  readonly selecao = computed<Selecao>(() => {
    const r = this.rota();
    const macros = this.regioes.dado() ?? [];
    const vazio: Selecao = { macro: null, regiao: null, municipio: null };
    if (r.visao === 'macro') return { ...vazio, macro: r.cd };
    if (r.visao === 'regiao') {
      const macro = macros.find((m) => m.regioes.some((x) => x.cd === r.cd))?.cd ?? null;
      return { macro, regiao: r.cd, municipio: null };
    }
    const cd = this.cdMunicipio();
    if (cd) {
      const m = this.listaMunicipios().find((x) => x.cd === cd);
      return { macro: m?.cdMacro ?? null, regiao: m?.cdRegiao ?? null, municipio: cd };
    }
    return vazio;
  });

  /** Municípios do recorte atual (macro/região), usados nos seletores e na lista. */
  readonly municipiosDoRecorte = computed(() => {
    const s = this.selecao();
    return this.listaMunicipios().filter((m) =>
      s.regiao ? m.cdRegiao === s.regiao : s.macro ? m.cdMacro === s.macro : true,
    );
  });

  /** Lista ordenada pelo tema (maior primeiro, sem dado por último), limitada a 100. */
  readonly ranking = computed(() => {
    const t = this.tema();
    return this.municipiosDoRecorte()
      .map((m) => ({ m, v: valorTema(m, t) }))
      .sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity) || a.m.nome.localeCompare(b.m.nome, 'pt-BR'))
      .slice(0, LIMITE_LISTA);
  });

  /** Totais do recorte (MG inteiro quando nada está selecionado). */
  readonly totaisRecorte = computed(() => {
    const lista = this.municipiosDoRecorte();
    const meta = this.meta.dado();
    if (!this.selecao().macro && !this.selecao().regiao && meta) {
      return { ...meta.totais, porCategoria: meta.porCategoria as Partial<Record<CategoriaSlug, number>> };
    }
    const porCategoria: Partial<Record<CategoriaSlug, number>> = {};
    let populacao = 0;
    let estabelecimentos = 0;
    for (const m of lista) {
      populacao += m.populacao ?? 0;
      estabelecimentos += m.totalEstabelecimentos;
      for (const [k, v] of Object.entries(m.porCategoria) as [CategoriaSlug, number][]) {
        porCategoria[k] = (porCategoria[k] ?? 0) + v;
      }
    }
    return { municipios: lista.length, estabelecimentos, populacao, porCategoria };
  });

  readonly macros = computed<MacrorregiaoDTO[]>(() => this.regioes.dado() ?? []);

  /** Pontos do município filtrados só pelo texto (base das contagens por categoria). */
  private readonly pontosPorTexto = computed<PontoFeature[]>(() => {
    const todos = this.pontos.dado()?.features ?? [];
    const q = normalizar(this.rota().q);
    if (!q) return todos;
    return todos.filter((f) => normalizar(`${f.properties.nome} ${f.properties.bairro ?? ''}`).includes(q));
  });

  readonly contagemPorCategoria = computed(() => {
    const c: Partial<Record<CategoriaSlug, number>> = {};
    for (const f of this.pontosPorTexto()) c[f.properties.categoria] = (c[f.properties.categoria] ?? 0) + 1;
    return c;
  });

  /** Pontos visíveis: filtro de texto e de categoria aplicados. */
  readonly pontosVisiveis = computed<PontoFeature[]>(() => {
    const cat = this.rota().cat;
    const base = this.pontosPorTexto();
    return cat ? base.filter((f) => f.properties.categoria === cat) : base;
  });

  /** Região a enquadrar no mapa; muda de identidade só quando o alvo muda. */
  readonly alvo = computed<{ chave: string; bbox: BBox }>(() => {
    const r = this.rota();
    const macros = this.macros();
    if (r.visao === 'estabelecimento') {
      // A ficha centraliza no ponto; não reenquadra o município.
      return { chave: 'estabelecimento', bbox: BBOX_MG };
    }
    if (r.visao === 'macro') {
      const m = macros.find((x) => x.cd === r.cd);
      if (m) return { chave: `macro:${m.cd}`, bbox: m.bbox };
    } else if (r.visao === 'regiao') {
      for (const m of macros) {
        const reg = m.regioes.find((x) => x.cd === r.cd);
        if (reg) return { chave: `regiao:${reg.cd}`, bbox: reg.bbox };
      }
    } else if (this.cdMunicipio()) {
      const mun = this.municipio.dado();
      if (mun && mun.cd === this.cdMunicipio()) return { chave: `municipio:${mun.cd}`, bbox: mun.bbox };
    } else if (r.visao === 'mg') {
      return { chave: 'mg', bbox: BBOX_MG };
    }
    return { chave: 'pendente', bbox: BBOX_MG };
  });

  readonly carregandoGeral = computed(
    () =>
      this.meta.carregando() ||
      this.regioes.carregando() ||
      this.municipios.carregando() ||
      this.municipio.carregando() ||
      this.pontos.carregando(),
  );

  readonly erroGeral = computed(
    () => this.meta.erro() ?? this.regioes.erro() ?? this.municipios.erro() ?? this.municipio.erro() ?? this.pontos.erro(),
  );

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.rota.set(parseRota(e.urlAfterRedirects));
    });
  }

  // --- navegação (a URL muda; `rota` segue) ---
  private ir(parcial: Partial<EstadoRota>, substituir = false): void {
    const url = montarUrl({ ...this.rota(), ...parcial });
    void this.router.navigateByUrl(url, { replaceUrl: substituir });
  }

  tentarNovamente(): void {
    this.tentativa.update((n) => n + 1);
  }

  definirTema(tema: TemaId): void {
    this.ir({ tema }, true);
  }

  irParaMg(): void {
    this.ir({ visao: 'mg', cd: null, cnes: null, cat: null, q: '' });
  }

  selecionarMacro(cd: string | null): void {
    if (!cd) return this.irParaMg();
    this.ir({ visao: 'macro', cd, cnes: null, cat: null, q: '' });
  }

  selecionarRegiao(cd: string | null): void {
    if (cd) return this.ir({ visao: 'regiao', cd, cnes: null, cat: null, q: '' });
    this.selecionarMacro(this.selecao().macro);
  }

  selecionarMunicipio(cd: string | null): void {
    if (cd) return this.ir({ visao: 'municipio', cd, cnes: null, cat: null, q: '' });
    const s = this.selecao();
    if (s.regiao) this.selecionarRegiao(s.regiao);
    else this.selecionarMacro(s.macro);
  }

  filtrarCategoria(cat: CategoriaSlug | null): void {
    this.ir({ cat: this.rota().cat === cat ? null : cat }, true);
  }

  filtrarTexto(q: string): void {
    this.ir({ q }, true);
  }

  abrirEstabelecimento(cnes: string): void {
    this.voltarPara = this.rota().visao === 'perto' ? this.router.url : null;
    this.ir({ visao: 'estabelecimento', cnes, cd: null, modoRota: null, de: null });
  }

  /** Fecha a ficha e volta ao município (mantendo filtros), ou a MG se não houver município. */
  fecharFicha(): void {
    if (this.voltarPara) {
      const url = this.voltarPara;
      this.voltarPara = null;
      void this.router.navigateByUrl(url);
      return;
    }
    const cd = this.cdMunicipio();
    if (cd) this.ir({ visao: 'municipio', cd, cnes: null });
    else this.irParaMg();
  }

  /** "Limpar": volta à visão inicial de MG, sem seleção nem filtros (o tema é mantido). */
  limpar(): void {
    this.irParaMg();
  }

  // --- perto de mim ---

  /**
   * Abre a visão "perto" num ponto (arredondado a 4 casas); sem ponto, mostra as opções para obtê-lo.
   * `onde` é o nome do lugar buscado; GPS e toque no mapa não têm nome.
   */
  irParaPerto(ponto: Ponto | null, substituir = false, onde = ''): void {
    this.ir(
      {
        visao: 'perto', cd: null, cnes: null, cat: null, q: '', raio: 30, modoRota: null, de: null,
        ponto: ponto && ARREDONDA(ponto), onde: ponto ? onde : '',
      },
      substituir,
    );
  }

  /** Bairro ou endereço escolhido na busca: estabelecimentos perto dele. */
  irParaLugar(l: LugarDTO): void {
    this.localizacao.cancelarEscolha();
    this.irParaPerto({ lat: l.lat, lon: l.lon }, false, l.descricao ? `${l.nome}, ${l.descricao}` : l.nome);
  }

  /** "Perto de mim": abre o painel e pede a localização ao navegador. */
  async pertoDeMim(): Promise<void> {
    this.localizacao.cancelarEscolha();
    this.irParaPerto(null);
    const p = await this.localizacao.obter();
    if (p) this.irParaPerto(p, true);
  }

  /** Atualiza a posição do painel "perto" via GPS. */
  async atualizarPosicao(): Promise<void> {
    const p = await this.localizacao.obter();
    if (p) this.irParaPerto(p, true);
  }

  ampliarRaio(): void {
    this.ir({ raio: 100 }, true);
  }

  escolherNoMapa(para: 'perto' | 'rota'): void {
    this.localizacao.iniciarEscolha(para);
  }

  /** "Usar este ponto": aplica o ponto tocado no mapa ao que pediu a escolha. */
  confirmarPontoTocado(): void {
    const p = this.localizacao.pontoTocado();
    const para = this.localizacao.escolhendo();
    this.localizacao.cancelarEscolha();
    if (!p || !para) return;
    if (para === 'perto') this.irParaPerto(p, this.rota().visao === 'perto');
    else this.ir({ modoRota: this.rota().modoRota ?? 'auto', de: ARREDONDA(p) }, true);
  }

  // --- rotas ---

  /** Escolhe o modo e calcula a rota; sem origem conhecida, pede a localização. */
  async comoChegar(modo: ModoRota): Promise<void> {
    const r = this.rota();
    let de: Ponto | null = r.de ?? this.localizacao.posicao();
    if (!de) {
      this.ir({ modoRota: modo, de: null }, true);
      de = await this.localizacao.obter();
    }
    this.ir({ modoRota: modo, de: de && ARREDONDA(de) }, true);
  }

  limparRota(): void {
    this.ir({ modoRota: null, de: null }, true);
  }

  // --- setores ---

  /** Pedidos para o mapa aproximar até os setores aparecerem (contador: cada pedido é um valor novo). */
  readonly pedidoZoomSetores = signal(0);

  /** Liga/desliga os setores; ao ligar, o mapa aproxima até o zoom em que eles aparecem. */
  definirSetores(ligado: boolean): void {
    this.ir({ setores: ligado }, true);
    if (ligado) this.aproximarSetores();
  }

  aproximarSetores(): void {
    this.pedidoZoomSetores.update((n) => n + 1);
  }
}

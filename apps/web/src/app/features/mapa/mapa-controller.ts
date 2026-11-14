import { CATEGORIAS, type BBox } from '@webgissus/domain';
import type { GeoJSONSource, IControl, LngLatLike, Map as MlMap, MapGeoJSONFeature, Popup } from 'maplibre-gl';
import { COR_SEM_DADO, expressaoCor } from '../../core/escala';
import type { PontoFeature } from '../../core/geojson';
import type { Tema } from '../../core/temas';
import { decimal, numero } from '../../shared/formatadores';
import { COR_SEM_DENSIDADE, CORES_DENSIDADE_SETOR, QUEBRAS_DENSIDADE_SETOR } from '../../core/setores';

export const ESTILO_BASE = 'https://tiles.openfreemap.org/styles/positron';
const ATRIBUICAO_DADOS =
  'Malha e população: <a href="https://www.ibge.gov.br" target="_blank" rel="noopener">IBGE</a> · Estabelecimentos: <a href="https://cnes.datasus.gov.br" target="_blank" rel="noopener">CNES/DATASUS</a>';

export interface AcoesMapa {
  verEstabelecimentos(cd: string): void;
  abrirEstabelecimento(cnes: string): void;
  /** Botão "Perto de mim" do mapa. */
  pertoDeMim(): void;
  /** Toque no mapa enquanto o modo "escolher ponto" está ativo. */
  pontoTocado(lat: number, lon: number): void;
  zoomMudou(zoom: number): void;
  /** Chamado quando o mapa terminou de carregar o estilo e as camadas. */
  pronto(): void;
}

export interface Folgas {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const COR_PONTO = (): unknown[] => [
  'match',
  ['get', 'categoria'],
  ...CATEGORIAS.flatMap((c) => [c.slug, c.cor]),
  '#555555',
];

/** Cria um elemento com texto seguro (sem innerHTML). */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, texto?: string, classe?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (texto !== undefined) e.textContent = texto;
  if (classe) e.className = classe;
  return e;
}

/** Conteúdo do popup de município (propriedades vêm do tile). */
export function conteudoPopupMunicipio(
  p: Record<string, unknown>,
  aoVer: (cd: string) => void,
): HTMLElement {
  const raiz = el('div', undefined, 'popup');
  raiz.append(el('h3', String(p['nome'] ?? 'Município')));
  const linha = (rotulo: string, valor: string) => {
    const l = el('div', undefined, 'popup-linha');
    l.append(el('span', rotulo), el('b', valor));
    raiz.append(l);
  };
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
  linha('População', numero(num('populacao')));
  linha('Densidade', `${decimal(num('densidade'), 1)} hab/km²`);
  linha('Estabelecimentos', numero(num('total')));
  linha('Por 10 mil hab.', decimal(num('estab_por_10mil'), 1));

  const cats = CATEGORIAS.filter((c) => (num(c.slug) ?? 0) > 0);
  if (cats.length) {
    const ul = el('ul', undefined, 'popup-cats');
    for (const c of cats) {
      const li = el('li');
      const sw = el('span', undefined, 'sw');
      sw.style.background = c.cor;
      li.append(sw, el('span', c.rotulo), el('b', numero(num(c.slug))));
      ul.append(li);
    }
    raiz.append(ul);
  }
  const cd = String(p['cd'] ?? '');
  const botao = el('button', 'Ver estabelecimentos', 'btn');
  botao.type = 'button';
  botao.addEventListener('click', () => aoVer(cd));
  raiz.append(botao);
  return raiz;
}

/** Conteúdo do popup de setor censitário (propriedades vêm do tile). */
export function conteudoPopupSetor(p: Record<string, unknown>): HTMLElement {
  const raiz = el('div', undefined, 'popup');
  raiz.append(el('h3', 'Setor censitário'));
  const linha = (rotulo: string, valor: string) => {
    const l = el('div', undefined, 'popup-linha');
    l.append(el('span', rotulo), el('b', valor));
    raiz.append(l);
  };
  const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
  linha('Código', String(p['cd_setor'] ?? '—'));
  linha('População', numero(num('populacao')));
  linha('Área', `${decimal(num('area_km2'), 2)} km²`);
  linha('Densidade', `${decimal(num('densidade'), 1)} hab/km²`);
  return raiz;
}

/** Botão "Perto de mim" como controle do mapa. */
class ControlePerto implements IControl {
  private raiz?: HTMLElement;
  constructor(private readonly aoClicar: () => void) {}
  onAdd(): HTMLElement {
    const div = el('div', undefined, 'maplibregl-ctrl maplibregl-ctrl-group');
    const b = el('button', undefined, 'ctrl-perto');
    b.type = 'button';
    b.title = 'Perto de mim';
    b.setAttribute('aria-label', 'Perto de mim: mostrar estabelecimentos próximos à minha localização');
    b.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="#1565c0"/><circle cx="12" cy="12" r="7" fill="none" stroke="#1565c0" stroke-width="2"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="#1565c0" stroke-width="2" stroke-linecap="round"/></svg>';
    b.addEventListener('click', this.aoClicar);
    div.append(b);
    this.raiz = div;
    return div;
  }
  onRemove(): void {
    this.raiz?.remove();
  }
}

/** Encapsula o MapLibre (só no navegador): camadas, interação e popups. */
export class MapaController {
  private map!: MlMap;
  private popup!: Popup;
  private dica!: Popup;
  private emMunicipio = false;
  private emPerto = false;
  private escolhendo = false;
  private setoresLigados = false;

  private constructor(
    private readonly ml: typeof import('maplibre-gl'),
    private readonly acoes: AcoesMapa,
  ) {}

  /** Carrega MapLibre e pmtiles sob demanda e inicia o mapa. */
  static async criar(container: HTMLElement, acoes: AcoesMapa): Promise<MapaController> {
    const [ml, pm] = await Promise.all([import('maplibre-gl'), import('pmtiles')]);
    const c = new MapaController(ml, acoes);
    c.iniciar(container, pm);
    return c;
  }

  private iniciar(container: HTMLElement, pm: typeof import('pmtiles')): void {
    const { Map, Popup, NavigationControl, addProtocol, setWorkerUrl } = this.ml;
    // O worker do MapLibre 6 é um módulo separado; o bundler não o embute, então é servido de /maplibre.
    setWorkerUrl(`${location.origin}/maplibre/maplibre-gl-worker.mjs`);
    addProtocol('pmtiles', new pm.Protocol().tile);
    this.map = new Map({
      container,
      style: ESTILO_BASE,
      bounds: [-51.05, -22.93, -39.85, -14.22],
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true, customAttribution: ATRIBUICAO_DADOS },
      cooperativeGestures: false,
    });
    this.map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl(new ControlePerto(() => this.acoes.pertoDeMim()), 'top-right');
    this.popup = new Popup({ maxWidth: '320px', closeButton: true });
    this.dica = new Popup({ closeButton: false, closeOnClick: false, offset: 8, className: 'dica' });
    this.map.once('style.load', () => {
      this.adicionarCamadas();
      this.ligarInteracao();
      this.acoes.pronto();
    });
  }

  private adicionarCamadas(): void {
    const m = this.map;
    const origem = location.origin;
    const primeiroTexto = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;

    m.addSource('municipios', {
      type: 'vector',
      url: `pmtiles://${origem}/tiles/municipios.pmtiles`,
    });
    m.addSource('regioes', { type: 'vector', url: `pmtiles://${origem}/tiles/regioes.pmtiles` });

    m.addLayer(
      {
        id: 'mun-fill',
        type: 'fill',
        source: 'municipios',
        'source-layer': 'municipios',
        paint: { 'fill-color': COR_SEM_DADO, 'fill-opacity': 0.78 },
      },
      primeiroTexto,
    );
    m.addLayer(
      {
        id: 'mun-line',
        type: 'line',
        source: 'municipios',
        'source-layer': 'municipios',
        paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.3, 10, 1] },
      },
      primeiroTexto,
    );
    m.addLayer(
      {
        id: 'regioes-line',
        type: 'line',
        source: 'regioes',
        'source-layer': 'regioes',
        paint: { 'line-color': '#37474f', 'line-width': 0.9, 'line-opacity': 0.6, 'line-dasharray': [3, 2] },
      },
      primeiroTexto,
    );
    m.addLayer(
      {
        id: 'macros-line',
        type: 'line',
        source: 'regioes',
        'source-layer': 'macros',
        paint: { 'line-color': '#263238', 'line-width': 1.8, 'line-opacity': 0.85 },
      },
      primeiroTexto,
    );
    m.addLayer(
      {
        id: 'mun-sel',
        type: 'line',
        source: 'municipios',
        'source-layer': 'municipios',
        filter: ['==', ['to-string', ['get', 'cd']], ''],
        paint: { 'line-color': '#0d47a1', 'line-width': 3 },
      },
      primeiroTexto,
    );

    m.addSource('setores', {
      type: 'vector',
      url: `pmtiles://${origem}/tiles/setores.pmtiles`,
      attribution: 'Setores: <a href="https://www.ibge.gov.br" target="_blank" rel="noopener">IBGE (Censo 2022)</a>',
    });
    m.addLayer(
      {
        id: 'setores-fill',
        type: 'fill',
        source: 'setores',
        'source-layer': 'setores',
        minzoom: 9,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'step',
            ['coalesce', ['get', 'densidade'], -1],
            COR_SEM_DENSIDADE,
            0,
            CORES_DENSIDADE_SETOR[0],
            ...QUEBRAS_DENSIDADE_SETOR.flatMap((q, i) => [q, CORES_DENSIDADE_SETOR[i + 1]]),
          ] as never,
          'fill-opacity': 0.72,
        },
      },
      'regioes-line',
    );
    m.addLayer(
      {
        id: 'setores-line',
        type: 'line',
        source: 'setores',
        'source-layer': 'setores',
        minzoom: 9,
        layout: { visibility: 'none' },
        paint: { 'line-color': '#5d4037', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.2, 14, 0.8], 'line-opacity': 0.6 },
      },
      'regioes-line',
    );
    m.addSource('rota', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({
      id: 'rota-contorno',
      type: 'line',
      source: 'rota',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 7, 16, 13] },
    });
    m.addLayer({
      id: 'rota-linha',
      type: 'line',
      source: 'rota',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#d81b60', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 16, 7] },
    });

    m.addSource('estab', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: 42,
      clusterMaxZoom: 13,
    });
    m.addLayer({
      id: 'estab-cluster',
      type: 'circle',
      source: 'estab',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#37474f',
        'circle-radius': ['step', ['get', 'point_count'], 15, 25, 19, 100, 24, 500, 30],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
    m.addLayer({
      id: 'estab-cluster-n',
      type: 'symbol',
      source: 'estab',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#ffffff' },
    });
    m.addLayer({
      id: 'estab-pt',
      type: 'circle',
      source: 'estab',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': COR_PONTO() as never,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 14, 9],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
      },
    });
    m.addLayer({
      id: 'estab-sel',
      type: 'circle',
      source: 'estab',
      filter: ['==', ['get', 'cnes'], ''],
      paint: {
        'circle-color': 'rgba(0,0,0,0)',
        'circle-radius': 15,
        'circle-stroke-color': '#0d47a1',
        'circle-stroke-width': 3,
      },
    });

    // Resultados de "perto de mim", posição do usuário e ponto tocado ficam por cima de tudo.
    m.addSource('perto', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({
      id: 'perto-pt',
      type: 'circle',
      source: 'perto',
      paint: {
        'circle-color': COR_PONTO() as never,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 14, 10],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
    m.addLayer({
      id: 'perto-n',
      type: 'symbol',
      source: 'perto',
      layout: { 'text-field': ['get', 'ordem'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.55)', 'text-halo-width': 1 },
    });
    m.addSource('usuario', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({
      id: 'usuario-halo',
      type: 'circle',
      source: 'usuario',
      paint: { 'circle-color': '#1565c0', 'circle-opacity': 0.18, 'circle-radius': 22 },
    });
    m.addLayer({
      id: 'usuario-pt',
      type: 'circle',
      source: 'usuario',
      paint: { 'circle-color': '#1565c0', 'circle-radius': 8, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
    });
    m.addSource('toque', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    m.addLayer({
      id: 'toque-pt',
      type: 'circle',
      source: 'toque',
      paint: { 'circle-color': '#ffffff', 'circle-radius': 9, 'circle-stroke-color': '#d81b60', 'circle-stroke-width': 4 },
    });
  }

  private ligarInteracao(): void {
    const m = this.map;
    const ponteiro = (camada: string) => {
      m.on('mouseenter', camada, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', camada, () => (m.getCanvas().style.cursor = ''));
    };
    ['mun-fill', 'estab-pt', 'estab-cluster', 'perto-pt', 'setores-fill'].forEach(ponteiro);
    this.map.on('zoom', () => this.acoes.zoomMudou(m.getZoom()));
    this.acoes.zoomMudou(m.getZoom());
    m.on('click', (e) => {
      if (this.escolhendo) this.acoes.pontoTocado(e.lngLat.lat, e.lngLat.lng);
    });

    m.on('mousemove', 'mun-fill', (e) => {
      const nome = e.features?.[0]?.properties?.['nome'];
      if (!nome || this.emMunicipio || this.escolhendo || this.setoresVisiveis()) {
        this.dica.remove();
        return;
      }
      this.dica.setLngLat(e.lngLat).setText(String(nome)).addTo(m);
    });
    m.on('mouseleave', 'mun-fill', () => this.dica.remove());

    m.on('click', 'perto-pt', (e) => {
      if (this.escolhendo) return;
      const cnes = e.features?.[0]?.properties?.['cnes'];
      if (cnes) this.acoes.abrirEstabelecimento(String(cnes));
    });
    m.on('click', 'setores-fill', (e) => {
      if (this.escolhendo) return;
      if (m.queryRenderedFeatures(e.point, { layers: ['estab-pt', 'estab-cluster', 'perto-pt'] }).length) return;
      const props = e.features?.[0]?.properties;
      if (!props) return;
      this.dica.remove();
      this.popup.setLngLat(e.lngLat).setDOMContent(conteudoPopupSetor(props)).addTo(m);
    });
    m.on('click', 'estab-pt', (e) => {
      if (this.escolhendo) return;
      const f = e.features?.[0] as MapGeoJSONFeature | undefined;
      const cnes = f?.properties?.['cnes'];
      if (cnes) this.acoes.abrirEstabelecimento(String(cnes));
    });
    m.on('click', 'estab-cluster', async (e) => {
      if (this.escolhendo) return;
      const f = e.features?.[0];
      const id = f?.properties?.['cluster_id'];
      if (id === undefined || f?.geometry.type !== 'Point') return;
      const fonte = m.getSource('estab') as GeoJSONSource;
      const zoom = await fonte.getClusterExpansionZoom(id);
      m.easeTo({ center: f.geometry.coordinates as LngLatLike, zoom: zoom + 0.5 });
    });
    m.on('click', 'mun-fill', (e) => {
      // Pontos e clusters têm prioridade sobre o polígono.
      if (this.escolhendo || this.setoresVisiveis()) return;
      if (m.queryRenderedFeatures(e.point, { layers: ['estab-pt', 'estab-cluster', 'perto-pt'] }).length) return;
      const props = e.features?.[0]?.properties;
      if (!props || this.emMunicipio) return;
      this.dica.remove();
      this.popup
        .setLngLat(e.lngLat)
        .setDOMContent(
          conteudoPopupMunicipio(props, (cd) => {
            this.popup.remove();
            this.acoes.verEstabelecimentos(cd);
          }),
        )
        .addTo(m);
    });
  }

  /** Setores aparecem só com a camada ligada e zoom >= 9 (minzoom das camadas). */
  private setoresVisiveis(): boolean {
    return this.setoresLigados && this.map.getZoom() >= 9;
  }

  // --- API usada pelo componente ---

  /** Pinta o coroplético do tema com as quebras já calculadas. */
  aplicarTema(tema: Tema, quebras: readonly number[]): void {
    this.map.setPaintProperty('mun-fill', 'fill-color', expressaoCor(tema.prop, quebras, tema.cores) as never);
  }

  /** Muda entre a visão de MG (coroplético forte) e a de município (mapa quase limpo, só contorno). */
  definirMunicipio(cd: string | null): void {
    this.emMunicipio = cd !== null;
    this.popup.remove();
    this.dica.remove();
    this.atualizarOpacidadeMunicipios();
    this.map.setFilter('mun-sel', ['==', ['to-string', ['get', 'cd']], cd ?? '']);
  }

  /** Na visão "perto" o coroplético também fica quase limpo, para os pontos aparecerem sobre o mapa-base. */
  definirPertoAtivo(ativo: boolean): void {
    this.emPerto = ativo;
    this.atualizarOpacidadeMunicipios();
  }

  private atualizarOpacidadeMunicipios(): void {
    this.map.setPaintProperty('mun-fill', 'fill-opacity', this.emMunicipio || this.emPerto ? 0.08 : 0.78);
  }

  definirPontos(features: PontoFeature[]): void {
    (this.map.getSource('estab') as GeoJSONSource).setData({ type: 'FeatureCollection', features } as never);
  }

  definirSelecionado(cnes: string | null): void {
    this.map.setFilter('estab-sel', ['==', ['get', 'cnes'], cnes ?? '']);
  }

  enquadrar(bbox: BBox, folgas: Folgas, animar = true): void {
    this.map.fitBounds(bbox, { padding: folgas, duration: animar ? 800 : 0, maxZoom: 15 });
  }

  focar(lon: number, lat: number, folgas: Folgas): void {
    this.map.easeTo({ center: [lon, lat], zoom: Math.max(this.map.getZoom(), 14), padding: folgas, duration: 700 });
  }

  definirSetores(ligado: boolean): void {
    this.setoresLigados = ligado;
    for (const id of ['setores-fill', 'setores-line']) this.map.setLayoutProperty(id, 'visibility', ligado ? 'visible' : 'none');
  }

  /** Resultados de "perto de mim", numerados na ordem da lista. */
  definirPerto(itens: { cnes: string; categoria: string; lon: number; lat: number }[]): void {
    const features = itens.map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { cnes: p.cnes, categoria: p.categoria, ordem: String(i + 1) },
    }));
    (this.map.getSource('perto') as GeoJSONSource).setData({ type: 'FeatureCollection', features } as never);
  }

  private definirPonto(fonte: string, p: { lat: number; lon: number } | null): void {
    const features = p ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: {} }] : [];
    (this.map.getSource(fonte) as GeoJSONSource).setData({ type: 'FeatureCollection', features } as never);
  }

  definirUsuario(p: { lat: number; lon: number } | null): void {
    this.definirPonto('usuario', p);
  }

  /** Ponto tocado no mapa, à espera de confirmação. */
  definirToque(p: { lat: number; lon: number } | null): void {
    this.definirPonto('toque', p);
  }

  /** Liga o modo "escolher ponto": cursor de mira e sem popups. */
  definirEscolha(ativa: boolean): void {
    this.escolhendo = ativa;
    this.map.getCanvas().style.cursor = ativa ? 'crosshair' : '';
    if (ativa) {
      this.popup.remove();
      this.dica.remove();
    }
  }

  definirRota(coordenadas: [number, number][] | null): void {
    const features = coordenadas
      ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coordenadas }, properties: {} }]
      : [];
    (this.map.getSource('rota') as GeoJSONSource).setData({ type: 'FeatureCollection', features } as never);
  }

  /** Enquadra um conjunto de coordenadas [lon, lat]. */
  enquadrarPontos(coordenadas: [number, number][], folgas: Folgas, maxZoom = 15): void {
    if (!coordenadas.length) return;
    const lons = coordenadas.map((c) => c[0]);
    const lats = coordenadas.map((c) => c[1]);
    this.map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: folgas, duration: 800, maxZoom },
    );
  }

  redimensionar(): void {
    this.map.resize();
  }

  destruir(): void {
    this.popup?.remove();
    this.dica?.remove();
    this.map?.remove();
  }
}
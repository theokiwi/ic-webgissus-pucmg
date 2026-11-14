import { CATEGORIAS, type BBox } from '@webgissus/domain';
import type { GeoJSONSource, LngLatLike, Map as MlMap, MapGeoJSONFeature, Popup } from 'maplibre-gl';
import { COR_SEM_DADO, expressaoCor } from '../../core/escala';
import type { PontoFeature } from '../../core/geojson';
import type { Tema } from '../../core/temas';
import { decimal, numero } from '../../shared/formatadores';

export const ESTILO_BASE = 'https://tiles.openfreemap.org/styles/positron';
const ATRIBUICAO_DADOS =
  'Malha e população: <a href="https://www.ibge.gov.br" target="_blank" rel="noopener">IBGE</a> · Estabelecimentos: <a href="https://cnes.datasus.gov.br" target="_blank" rel="noopener">CNES/DATASUS</a>';

export interface AcoesMapa {
  verEstabelecimentos(cd: string): void;
  abrirEstabelecimento(cnes: string): void;
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

/** Encapsula o MapLibre (só no navegador): camadas, interação e popups. */
export class MapaController {
  private map!: MlMap;
  private popup!: Popup;
  private dica!: Popup;
  private emMunicipio = false;

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
    const { Map, Popup, NavigationControl, GeolocateControl, addProtocol, setWorkerUrl } = this.ml;
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
    this.map.addControl(new GeolocateControl({ trackUserLocation: false }), 'top-right');
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
  }

  private ligarInteracao(): void {
    const m = this.map;
    const ponteiro = (camada: string) => {
      m.on('mouseenter', camada, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', camada, () => (m.getCanvas().style.cursor = ''));
    };
    ['mun-fill', 'estab-pt', 'estab-cluster'].forEach(ponteiro);

    m.on('mousemove', 'mun-fill', (e) => {
      const nome = e.features?.[0]?.properties?.['nome'];
      if (!nome || this.emMunicipio) {
        this.dica.remove();
        return;
      }
      this.dica.setLngLat(e.lngLat).setText(String(nome)).addTo(m);
    });
    m.on('mouseleave', 'mun-fill', () => this.dica.remove());

    m.on('click', 'estab-pt', (e) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined;
      const cnes = f?.properties?.['cnes'];
      if (cnes) this.acoes.abrirEstabelecimento(String(cnes));
    });
    m.on('click', 'estab-cluster', async (e) => {
      const f = e.features?.[0];
      const id = f?.properties?.['cluster_id'];
      if (id === undefined || f?.geometry.type !== 'Point') return;
      const fonte = m.getSource('estab') as GeoJSONSource;
      const zoom = await fonte.getClusterExpansionZoom(id);
      m.easeTo({ center: f.geometry.coordinates as LngLatLike, zoom: zoom + 0.5 });
    });
    m.on('click', 'mun-fill', (e) => {
      // Pontos e clusters têm prioridade sobre o polígono.
      if (m.queryRenderedFeatures(e.point, { layers: ['estab-pt', 'estab-cluster'] }).length) return;
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
    this.map.setPaintProperty('mun-fill', 'fill-opacity', this.emMunicipio ? 0.08 : 0.78);
    this.map.setFilter('mun-sel', ['==', ['to-string', ['get', 'cd']], cd ?? '']);
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

  redimensionar(): void {
    this.map.resize();
  }

  destruir(): void {
    this.popup?.remove();
    this.dica?.remove();
    this.map?.remove();
  }
}

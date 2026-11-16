import { CATEGORIAS, type CategoriaSlug, type ModoRota } from '@webgissus/domain';
import { ehTemaId, TEMA_PADRAO, type TemaId } from './temas';

export type Visao = 'mg' | 'macro' | 'regiao' | 'municipio' | 'estabelecimento' | 'perto';

export interface Ponto {
  lat: number;
  lon: number;
}

export const MODOS_ROTA: readonly ModoRota[] = ['auto', 'pedestre', 'bicicleta'];
export type RaioKm = 30 | 100;

/** Tudo que a URL descreve: recarregar a página reconstrói a tela a partir disto. */
export interface EstadoRota {
  visao: Visao;
  /** Macrorregião, região de saúde ou município (IBGE, 7 dígitos), conforme a visão. */
  cd: string | null;
  cnes: string | null;
  tema: TemaId;
  /** Filtro de categoria na visão do município. */
  cat: CategoriaSlug | null;
  /** Filtro local por nome/bairro. */
  q: string;
  /** Visão `perto`: ponto de consulta (4 casas decimais, ver `arredondarCoord`). */
  ponto: Ponto | null;
  /** Visão `perto`: raio da busca em km. */
  raio: RaioKm;
  /** Visão `perto`: nome do lugar buscado (bairro ou endereço); vazio quando o ponto veio do GPS ou do mapa. */
  onde: string;
  /** Ficha: modo da rota até o estabelecimento. */
  modoRota: ModoRota | null;
  /** Ficha: origem da rota (4 casas decimais). */
  de: Ponto | null;
  /** Camada de setores censitários ligada. */
  setores: boolean;
}

export const ESTADO_INICIAL: EstadoRota = {
  visao: 'mg',
  cd: null,
  cnes: null,
  tema: TEMA_PADRAO,
  cat: null,
  q: '',
  ponto: null,
  raio: 30,
  onde: '',
  modoRota: null,
  de: null,
  setores: false,
};

const SO_DIGITOS = /^\d{1,12}$/;

/** Privacidade: a posição do usuário só entra na URL com ~11 m de precisão. */
export function arredondarCoord(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function lerPonto(lat: string | null, lon: string | null): Ponto | null {
  if (lat === null || lon === null || lat.trim() === '' || lon.trim() === '') return null;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: arredondarCoord(la), lon: arredondarCoord(lo) };
}

function ehModo(v: string | null): v is ModoRota {
  return v !== null && (MODOS_ROTA as readonly string[]).includes(v);
}

function ehCategoria(v: string | null): v is CategoriaSlug {
  return v !== null && CATEGORIAS.some((c) => c.slug === v);
}

/** Interpreta uma URL (`/municipio/3106200?cat=hospital`). URLs inválidas voltam à visão de MG. */
export function parseRota(url: string): EstadoRota {
  const semHash = url.split('#')[0];
  const [caminho, consulta = ''] = semHash.split('?');
  const params = new URLSearchParams(consulta);
  const segs = caminho.split('/').filter(Boolean).map(decodeURIComponent);

  const temaParam = params.get('tema');
  const catParam = params.get('cat');
  const base: EstadoRota = {
    ...ESTADO_INICIAL,
    tema: ehTemaId(temaParam) ? temaParam : TEMA_PADRAO,
    cat: ehCategoria(catParam) ? catParam : null,
    q: (params.get('q') ?? '').slice(0, 80),
    setores: params.get('setores') === '1',
  };

  const [tipo, id] = segs;
  if (segs.length === 1 && tipo === 'perto') {
    return {
      ...base,
      visao: 'perto',
      q: '',
      ponto: lerPonto(params.get('lat'), params.get('lon')),
      raio: params.get('raio') === '100' ? 100 : 30,
      onde: (params.get('onde') ?? '').trim().slice(0, 80),
    };
  }
  if (segs.length === 2 && SO_DIGITOS.test(id)) {
    if (tipo === 'macro' || tipo === 'regiao' || tipo === 'municipio') return { ...base, visao: tipo, cd: id };
    if (tipo === 'estabelecimento') {
      const deParam = params.get('de')?.split(',') ?? [];
      const modoParam = params.get('rota');
      return {
        ...base,
        visao: 'estabelecimento',
        cnes: id,
        modoRota: ehModo(modoParam) ? modoParam : null,
        de: lerPonto(deParam[0] ?? null, deParam[1] ?? null),
      };
    }
  }
  return { ...base, cat: null, q: '' };
}

/** Inverso de `parseRota`; omite parâmetros com valor padrão. */
export function montarUrl(e: EstadoRota): string {
  let caminho = '/';
  if (e.visao === 'macro' || e.visao === 'regiao' || e.visao === 'municipio') {
    if (e.cd) caminho = `/${e.visao}/${e.cd}`;
  } else if (e.visao === 'estabelecimento' && e.cnes) {
    caminho = `/estabelecimento/${e.cnes}`;
  } else if (e.visao === 'perto') {
    caminho = '/perto';
  }
  const usaFiltros = e.visao === 'municipio' || e.visao === 'estabelecimento' || e.visao === 'perto';
  const params = new URLSearchParams();
  if (e.visao === 'perto' && e.ponto) {
    params.set('lat', String(arredondarCoord(e.ponto.lat)));
    params.set('lon', String(arredondarCoord(e.ponto.lon)));
    if (e.raio === 100) params.set('raio', '100');
    if (e.onde.trim()) params.set('onde', e.onde.trim());
  }
  if (e.visao === 'estabelecimento' && e.modoRota) {
    params.set('rota', e.modoRota);
    if (e.de) params.set('de', `${arredondarCoord(e.de.lat)},${arredondarCoord(e.de.lon)}`);
  }
  if (e.tema !== TEMA_PADRAO) params.set('tema', e.tema);
  if (e.setores) params.set('setores', '1');
  if (usaFiltros && e.cat) params.set('cat', e.cat);
  if (usaFiltros && e.visao !== 'perto' && e.q.trim()) params.set('q', e.q.trim());
  // A vírgula de `de=lat,lon` é legal em query string; deixa a URL legível.
  const s = params.toString().replace(/%2C/gi, ',');
  return s ? `${caminho}?${s}` : caminho;
}

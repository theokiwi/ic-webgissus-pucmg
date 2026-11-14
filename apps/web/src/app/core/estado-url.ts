import { CATEGORIAS, type CategoriaSlug } from '@webgissus/domain';
import { ehTemaId, TEMA_PADRAO, type TemaId } from './temas';

export type Visao = 'mg' | 'macro' | 'regiao' | 'municipio' | 'estabelecimento';

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
}

export const ESTADO_INICIAL: EstadoRota = {
  visao: 'mg',
  cd: null,
  cnes: null,
  tema: TEMA_PADRAO,
  cat: null,
  q: '',
};

const SO_DIGITOS = /^\d{1,12}$/;

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
  };

  const [tipo, id] = segs;
  if (segs.length === 2 && SO_DIGITOS.test(id)) {
    if (tipo === 'macro' || tipo === 'regiao' || tipo === 'municipio') return { ...base, visao: tipo, cd: id };
    if (tipo === 'estabelecimento') return { ...base, visao: 'estabelecimento', cnes: id };
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
  }
  const usaFiltros = e.visao === 'municipio' || e.visao === 'estabelecimento';
  const params = new URLSearchParams();
  if (e.tema !== TEMA_PADRAO) params.set('tema', e.tema);
  if (usaFiltros && e.cat) params.set('cat', e.cat);
  if (usaFiltros && e.q.trim()) params.set('q', e.q.trim());
  const s = params.toString();
  return s ? `${caminho}?${s}` : caminho;
}

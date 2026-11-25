import type { EstabelecimentoPontoProps, PesquisaPontoProps } from '@webgissus/domain';

export interface PontoFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: EstabelecimentoPontoProps;
}

export interface PontosCollection {
  type: 'FeatureCollection';
  features: PontoFeature[];
}

/** Resultado da pesquisa por tipo (ADR 0010): os pontos levam município e valor do critério. */
export interface PesquisaFeature extends PontoFeature {
  properties: PesquisaPontoProps;
}

export interface PesquisaCollection {
  type: 'FeatureCollection';
  features: PesquisaFeature[];
}

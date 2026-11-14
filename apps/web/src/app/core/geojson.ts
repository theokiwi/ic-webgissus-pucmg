import type { EstabelecimentoPontoProps } from '@webgissus/domain';

export interface PontoFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: EstabelecimentoPontoProps;
}

export interface PontosCollection {
  type: 'FeatureCollection';
  features: PontoFeature[];
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CategoriaSlug,
  EstabelecimentoPontoProps,
  MunicipioDTO,
  MunicipioResumoDTO,
} from '@webgissus/domain';
import {
  MunicipiosRepository,
  type MunicipioDetalheRow,
  type MunicipioRow,
} from './municipios.repository.js';

export interface FeaturePonto {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: EstabelecimentoPontoProps;
}

export interface FeatureCollectionPontos {
  type: 'FeatureCollection';
  features: FeaturePonto[];
}

function resumo(r: MunicipioRow): MunicipioResumoDTO {
  const porCategoria = r.por_categoria as Partial<Record<CategoriaSlug, number>>;
  return {
    cd: r.cd,
    nome: r.nome,
    cdRegiao: r.cd_regiao,
    cdMacro: r.cd_macro,
    populacao: r.populacao,
    areaKm2: r.area_km2,
    densidade: r.densidade,
    totalEstabelecimentos: Object.values(porCategoria).reduce((a, b) => a + (b ?? 0), 0),
    porCategoria,
  };
}

function detalhe(r: MunicipioDetalheRow): MunicipioDTO {
  const base = resumo(r);
  return {
    ...base,
    nomeRegiao: r.nome_regiao,
    nomeMacro: r.nome_macro,
    bbox: [r.xmin, r.ymin, r.xmax, r.ymax],
    estabelecimentosPor10mil:
      r.populacao && r.populacao > 0 ? (base.totalEstabelecimentos / r.populacao) * 10_000 : null,
  };
}

@Injectable()
export class MunicipiosService {
  constructor(@Inject(MunicipiosRepository) private readonly repo: MunicipiosRepository) {}

  async listar(macro: string | null, regiao: string | null) {
    return (await this.repo.listar(macro, regiao)).map(resumo);
  }

  async obter(cd: string) {
    const r = await this.repo.obter(cd);
    if (!r) throw new NotFoundException(`Município ${cd} não encontrado`);
    return detalhe(r);
  }

  async estabelecimentos(cd: string, categoria: CategoriaSlug | null): Promise<FeatureCollectionPontos> {
    if (!(await this.repo.existe(cd))) throw new NotFoundException(`Município ${cd} não encontrado`);
    const linhas = await this.repo.pontos(cd, categoria);
    return {
      type: 'FeatureCollection',
      features: linhas.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: {
          cnes: p.cnes,
          nome: p.nome,
          categoria: p.categoria as CategoriaSlug,
          bairro: p.bairro,
          sempreAberto: p.sempre_aberto,
          coordOk: p.coord_ok,
        },
      })),
    };
  }
}

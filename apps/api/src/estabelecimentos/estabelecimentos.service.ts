import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BuscaItemDTO,
  CategoriaSlug,
  EstabelecimentoDTO,
  Natureza,
  ProximoDTO,
} from '@webgissus/domain';
import type { BuscaParams, ProximosParams } from '../common/params.js';
import { EstabelecimentosRepository } from './estabelecimentos.repository.js';
import { descricaoTipoUnidade } from './tipos-unidade.js';

@Injectable()
export class EstabelecimentosService {
  constructor(@Inject(EstabelecimentosRepository) private readonly repo: EstabelecimentosRepository) {}

  async proximos(p: ProximosParams): Promise<ProximoDTO[]> {
    const linhas = await this.repo.proximos(p.lat, p.lon, p.categoria, p.limite, p.raioKm);
    return linhas.map((r) => ({
      cnes: r.cnes,
      nome: r.nome,
      categoria: r.categoria as CategoriaSlug,
      natureza: r.natureza as Natureza,
      bairro: r.bairro,
      sempreAberto: r.sempre_aberto,
      coordOk: r.coord_ok,
      municipio: r.municipio,
      distanciaM: Math.round(r.distancia_m),
      lon: r.lon,
      lat: r.lat,
      horarios: r.horarios,
    }));
  }

  async busca(p: BuscaParams): Promise<BuscaItemDTO[]> {
    const linhas = await this.repo.busca(p.q, p.limite);
    return linhas.map((r) => ({
      cnes: r.cnes,
      nome: r.nome,
      categoria: r.categoria as CategoriaSlug,
      natureza: r.natureza as Natureza,
      municipio: r.municipio,
      bairro: r.bairro,
    }));
  }

  async obter(cnes: string): Promise<EstabelecimentoDTO> {
    const r = await this.repo.obter(cnes);
    if (!r) throw new NotFoundException(`Estabelecimento ${cnes} não encontrado`);
    const [horarios, servicos, atendimentos] = await Promise.all([
      this.repo.horarios(cnes),
      this.repo.servicos(cnes),
      this.repo.atendimentos(cnes),
    ]);
    return {
      cnes: r.cnes,
      // CO_UNIDADE: o município da unidade vem dos 6 primeiros dígitos dele na carga (CLAUDE.md).
      codigoUnidade: r.cd6_municipio + r.cnes,
      nome: r.nome,
      razaoSocial: r.razao_social,
      categoria: r.categoria as CategoriaSlug,
      tipoUnidade: { codigo: r.tp_unidade, descricao: descricaoTipoUnidade(r.tp_unidade) },
      municipio: { cd: r.cd_municipio, nome: r.municipio },
      endereco: {
        logradouro: r.logradouro,
        numero: r.numero,
        complemento: r.complemento,
        bairro: r.bairro,
        cep: r.cep,
      },
      telefone: r.telefone,
      email: r.email,
      natureza: r.natureza as EstabelecimentoDTO['natureza'],
      sempreAberto: r.sempre_aberto,
      turno: r.turno,
      horarios,
      servicos,
      atendimentos,
      coordOk: r.coord_ok,
      atualizadoEm: r.atualizado_em,
      lon: r.lon,
      lat: r.lat,
      competencia: r.competencia ?? '',
    };
  }
}

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CategoriaSlug, MetaDTO } from '@webgissus/domain';
import { SLUGS_CATEGORIA } from '../common/categorias.js';
import { MetaRepository } from './meta.repository.js';

@Injectable()
export class MetaService {
  constructor(
    @Inject(MetaRepository) private readonly repo: MetaRepository,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async obter(): Promise<MetaDTO> {
    const carga = await this.repo.ultimaCarga();
    if (!carga) throw new NotFoundException('Nenhuma carga registrada');
    const [totais, cats] = await Promise.all([this.repo.totais(), this.repo.porCategoria()]);
    const porCategoria = Object.fromEntries(SLUGS_CATEGORIA.map((s) => [s, 0])) as Record<
      CategoriaSlug,
      number
    >;
    for (const c of cats) porCategoria[c.categoria as CategoriaSlug] = c.n;
    return {
      competencia: carga.competencia,
      atualizadoEm: carga.atualizado_em.toISOString(),
      totais,
      porCategoria,
      rotas: Boolean(this.config.get<string>('VALHALLA_URL')),
    };
  }
}

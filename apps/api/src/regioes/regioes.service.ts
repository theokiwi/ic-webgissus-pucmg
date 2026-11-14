import { Inject, Injectable } from '@nestjs/common';
import type { BBox, MacrorregiaoDTO } from '@webgissus/domain';
import { RegioesRepository, type UnidadeRow } from './regioes.repository.js';

const bbox = (r: UnidadeRow): BBox => [r.xmin, r.ymin, r.xmax, r.ymax];

@Injectable()
export class RegioesService {
  constructor(@Inject(RegioesRepository) private readonly repo: RegioesRepository) {}

  async listar(): Promise<MacrorregiaoDTO[]> {
    const [macros, regioes] = await Promise.all([this.repo.macrorregioes(), this.repo.regioes()]);
    return macros.map((m) => ({
      cd: m.cd,
      nome: m.nome,
      bbox: bbox(m),
      regioes: regioes
        .filter((r) => r.cd_macro === m.cd)
        .map((r) => ({ cd: r.cd, nome: r.nome, bbox: bbox(r) })),
    }));
  }
}

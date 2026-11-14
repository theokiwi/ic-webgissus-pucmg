import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { parseDigitosOpcional } from '../common/params.js';
import { CategoriaPipe, CodigoMunicipioPipe } from '../common/pipes.js';
import type { CategoriaSlug } from '@webgissus/domain';
import { MunicipiosService } from './municipios.service.js';

@ApiTags('municipios')
@Controller('municipios')
export class MunicipiosController {
  constructor(@Inject(MunicipiosService) private readonly service: MunicipiosService) {}

  @Get()
  listar(@Query('macro') macro?: string, @Query('regiao') regiao?: string) {
    return this.service.listar(
      parseDigitosOpcional(macro, 4, 'macro'),
      parseDigitosOpcional(regiao, 5, 'regiao'),
    );
  }

  @Get(':cd')
  obter(@Param('cd', CodigoMunicipioPipe) cd: string) {
    return this.service.obter(cd);
  }

  @Get(':cd/estabelecimentos')
  estabelecimentos(
    @Param('cd', CodigoMunicipioPipe) cd: string,
    @Query('categoria', CategoriaPipe) categoria: CategoriaSlug | null,
  ) {
    return this.service.estabelecimentos(cd, categoria);
  }
}

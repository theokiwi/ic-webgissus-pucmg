import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { EstabelecimentosModule } from './estabelecimentos/estabelecimentos.module.js';
import { HealthController } from './health/health.controller.js';
import { MetaModule } from './meta/meta.module.js';
import { MunicipiosModule } from './municipios/municipios.module.js';
import { RegioesModule } from './regioes/regioes.module.js';
import { RotaModule } from './rota/rota.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    DatabaseModule,
    MetaModule,
    RegioesModule,
    MunicipiosModule,
    EstabelecimentosModule,
    RotaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

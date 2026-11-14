import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';

export const PG_POOL = Symbol('PG_POOL');
export const DATABASE_URL_PADRAO = 'postgres://webgissus:webgissus_dev@127.0.0.1:5432/webgissus';

@Injectable()
export class Db implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async linhas<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const r = await this.pool.query<T>(sql, params);
    return r.rows;
  }

  async primeira<T extends pg.QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
    return (await this.linhas<T>(sql, params))[0] ?? null;
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new pg.Pool({
          connectionString: config.get<string>('DATABASE_URL') ?? DATABASE_URL_PADRAO,
          max: 10,
        }),
    },
    Db,
  ],
  exports: [Db],
})
export class DatabaseModule {}

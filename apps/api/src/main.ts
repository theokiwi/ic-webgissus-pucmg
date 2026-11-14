import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './setup.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
configurarApp(app);
app.enableShutdownHooks();
await app.listen(process.env.PORT ?? 3000);

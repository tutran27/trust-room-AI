import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/client';

// Always hydrate Prisma from the repo root .env, regardless of which package
// directory the current dev/build process uses as its cwd.
loadEnv({
  path: path.resolve(__dirname, '../../../.env'),
});

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

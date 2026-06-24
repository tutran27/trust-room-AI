import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@trustroom/db';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();
    // Don't crash on missing DB — modules catch Prisma errors themselves
    this.$connect().catch((err: unknown) => {
      const target = this.describeDatabaseTarget();
      this.logger.warn(
        `DB unavailable at startup for ${target}, deferring (${(err as Error)?.message ?? err}). Some features will be unavailable until DB is reachable.`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private describeDatabaseTarget(): string {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) return 'DATABASE_URL=<missing>';

    try {
      const parsed = new URL(rawUrl);
      const port = parsed.port || '5432';
      const database = parsed.pathname.replace(/^\//, '') || '<unknown-db>';
      return `${parsed.hostname}:${port}/${database}`;
    } catch {
      return 'DATABASE_URL=<invalid>';
    }
  }
}

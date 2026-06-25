import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TermsController } from './terms.controller';
import { TermsService } from './terms.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}

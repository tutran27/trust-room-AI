import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReputationModule } from '../reputation/reputation.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    WebsocketModule,
    NotificationsModule,
    ReputationModule,
  ],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}

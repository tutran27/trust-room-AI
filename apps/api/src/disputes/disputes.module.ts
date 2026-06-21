import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DealsModule } from '../deals/deals.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    WebsocketModule,
    NotificationsModule,
    DealsModule,
  ],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}

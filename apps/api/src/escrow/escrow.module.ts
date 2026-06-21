import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { SolanaService } from './solana.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [DatabaseModule, AuthModule, NotificationsModule, WebsocketModule],
  controllers: [EscrowController],
  providers: [EscrowService, SolanaService],
  exports: [EscrowService, SolanaService],
})
export class EscrowModule {}

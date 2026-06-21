import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { DealsModule } from './deals/deals.module';
import { DisputesModule } from './disputes/disputes.module';
import { EscrowModule } from './escrow/escrow.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReputationModule } from './reputation/reputation.module';
import { WalletRiskModule } from './wallet-risk/wallet-risk.module';
import { AgoraModule } from './agora/agora.module';
import { AiModule } from './ai/ai.module';
import { WebsocketModule } from './websocket/websocket.module';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    DealsModule,
    DisputesModule,
    EscrowModule,
    NotificationsModule,
    ReputationModule,
    WalletRiskModule,
    AgoraModule,
    AiModule,
    WebsocketModule,
    MeetingsModule,
  ],
})
export class AppModule {}

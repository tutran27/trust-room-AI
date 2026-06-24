import path from 'node:path';
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
import { AgoraModule } from './agora/agora.module';
import { AiModule } from './ai/ai.module';
import { WebsocketModule } from './websocket/websocket.module';
import { MeetingsModule } from './meetings/meetings.module';
import { AiVoiceModule } from './ai-voice/ai-voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(__dirname, '../../../.env'),
      ],
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
    AgoraModule,
    AiModule,
    WebsocketModule,
    MeetingsModule,
    AiVoiceModule,
  ],
})
export class AppModule {}

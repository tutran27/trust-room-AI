import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AiVoiceController } from './ai-voice.controller';
import { AiVoiceService } from './ai-voice.service';

@Module({
  imports: [DatabaseModule, AuthModule, WebsocketModule],
  controllers: [AiVoiceController],
  providers: [AiVoiceService],
  exports: [AiVoiceService],
})
export class AiVoiceModule {}

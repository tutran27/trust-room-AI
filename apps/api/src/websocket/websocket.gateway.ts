import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_deal')
  handleJoinDeal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealId: string },
  ) {
    const room = `deal:${data.dealId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'joined', data: { dealId: data.dealId } };
  }

  @SubscribeMessage('leave_deal')
  handleLeaveDeal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealId: string },
  ) {
    const room = `deal:${data.dealId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
    return { event: 'left', data: { dealId: data.dealId } };
  }

  @SubscribeMessage('chat_message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dealId: string; message: string; sender: string },
  ) {
    const room = `deal:${data.dealId}`;
    this.server.to(room).emit('chat_message', {
      dealId: data.dealId,
      message: data.message,
      sender: data.sender,
      timestamp: new Date().toISOString(),
    });
    return { event: 'message_sent' };
  }

  // Emit methods for server-side events
  emitDealUpdate(dealId: string, payload: Record<string, unknown>) {
    this.server.to(`deal:${dealId}`).emit('deal_update', {
      dealId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  emitDisputeUpdate(disputeId: string, payload: Record<string, unknown>) {
    this.server.emit('dispute_update', {
      disputeId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  emitNotification(wallet: string, notification: Record<string, unknown>) {
    this.server.to(`user:${wallet}`).emit('notification', notification);
  }
}
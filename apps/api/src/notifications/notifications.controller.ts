import { Controller, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Req() req: any, @Query('unreadOnly') unreadOnly?: string) {
    const wallet = req.user.wallet;
    return this.notificationsService.listByWallet(wallet, unreadOnly === 'true');
  }

  @Get('unread-count')
  async unreadCount(@Req() req: any) {
    const wallet = req.user.wallet;
    return { count: await this.notificationsService.getUnreadCount(wallet) };
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    const wallet = req.user.wallet;
    return this.notificationsService.markAllAsRead(wallet);
  }
}
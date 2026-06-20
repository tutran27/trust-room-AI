import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationType } from '@trustroom/db';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(wallet: string, title: string, message: string, type: NotificationType, dealId?: string, metadata?: Record<string, unknown>) {
    return this.prisma.notification.create({
      data: {
        wallet,
        title,
        message,
        type,
        dealId,
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      },
    });
  }

  async listByWallet(wallet: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: {
        wallet,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllAsRead(wallet: string) {
    return this.prisma.notification.updateMany({
      where: { wallet, read: false },
      data: { read: true },
    });
  }

  async getUnreadCount(wallet: string) {
    return this.prisma.notification.count({
      where: { wallet, read: false },
    });
  }
}
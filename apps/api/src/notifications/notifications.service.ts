import { Inject, Injectable } from '@nestjs/common';
import { Prisma, NotificationType } from '@trustroom/db';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(wallet: string, title: string, message: string, type: NotificationType, dealId?: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.notification.create({
      data: {
        wallet,
        title,
        message,
        type,
        dealId,
        metadata: metadata ?? undefined,
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

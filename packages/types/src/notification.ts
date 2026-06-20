import { z } from 'zod';

export const notificationTypeSchema = z.enum([
  'deal_update',
  'terms_update',
  'risk_warning',
  'escrow_update',
  'dispute_update',
  'system',
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationChannelSchema = z.enum(['in_app', 'email', 'push']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  userWallet: z.string(),
  dealId: z.string().nullable(),
  type: notificationTypeSchema,
  channel: notificationChannelSchema.default('in_app'),
  title: z.string(),
  message: z.string(),
  isRead: z.boolean().default(false),
  actionUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;
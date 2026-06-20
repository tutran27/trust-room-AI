import { z } from 'zod';
import { dealStatusSchema } from './deal';
import { DealEvent } from './events';

/**
 * WebSocket event types emitted by the server.
 */
export const wsEventSchema = z.object({
  event: z.string(),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

export type WsEvent = z.infer<typeof wsEventSchema>;

/**
 * Deal room WebSocket events.
 */
export const dealRoomEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('deal.updated'),
    payload: z.object({
      dealId: z.string(),
      status: dealStatusSchema,
      version: z.number().int().nonnegative(),
      updatedAt: z.string().datetime(),
    }),
  }),
  z.object({
    event: z.literal('deal.event'),
    payload: z.object({
      dealId: z.string(),
      type: z.enum(Object.values(DealEvent) as [string, ...string[]]),
      actorWallet: z.string(),
      metadata: z.record(z.unknown()).optional(),
      timestamp: z.string().datetime(),
    }),
  }),
  z.object({
    event: z.literal('risk.detected'),
    payload: z.object({
      dealId: z.string(),
      riskLevel: z.string(),
      reason: z.string(),
      timestamp: z.string().datetime(),
    }),
  }),
  z.object({
    event: z.literal('escrow.updated'),
    payload: z.object({
      dealId: z.string(),
      escrowStatus: z.string(),
      amount: z.string(),
      txSignature: z.string().optional(),
    }),
  }),
]);

export type DealRoomEvent = z.infer<typeof dealRoomEventSchema>;

/**
 * Notification WebSocket event.
 */
export const notificationEventSchema = z.object({
  event: z.literal('notification.created'),
  payload: z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    message: z.string(),
    dealId: z.string().optional(),
    read: z.boolean(),
    createdAt: z.string().datetime(),
  }),
});

export type NotificationEvent = z.infer<typeof notificationEventSchema>;

import { z } from 'zod';

/**
 * Agora token request payload.
 */
export const agoraTokenRequestSchema = z.object({
  channel: z.string().min(1),
  uid: z.union([z.string(), z.number()]),
  role: z.enum(['publisher', 'subscriber']).default('publisher'),
  expiry: z.number().optional(), // token TTL in seconds
});

export type AgoraTokenRequest = z.infer<typeof agoraTokenRequestSchema>;

/**
 * Agora token response returned to the client.
 */
export const agoraTokenResponseSchema = z.object({
  token: z.string(),
  channel: z.string(),
  uid: z.union([z.string(), z.number()]),
  expiresAt: z.number(), // unix timestamp
});

export type AgoraTokenResponse = z.infer<typeof agoraTokenResponseSchema>;

/**
 * Agora session state tracked server-side.
 */
export const agoraSessionSchema = z.object({
  dealId: z.string().uuid(),
  channel: z.string(),
  participants: z.array(
    z.object({
      uid: z.union([z.string(), z.number()]),
      wallet: z.string(),
      joinedAt: z.string().datetime(),
      role: z.enum(['buyer', 'seller', 'ai_mediator']),
    }),
  ),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
});

export type AgoraSession = z.infer<typeof agoraSessionSchema>;
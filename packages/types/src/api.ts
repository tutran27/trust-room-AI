import { z } from 'zod';

// ──────────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────────

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  cursor: z.string().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      limit: z.number(),
      nextCursor: z.string().nullable(),
    }),
  });

// ──────────────────────────────────────────────
// Standard API response wrappers
// ──────────────────────────────────────────────

export const apiSuccessSchema = <T extends z.ZodTypeAny>(data: T) =>
  z.object({
    success: z.literal(true),
    data,
    timestamp: z.string().datetime(),
  });

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  timestamp: z.string().datetime(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────

export const healthCheckSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  uptime: z.number(),
  version: z.string(),
  checks: z.record(
    z.object({
      status: z.enum(['ok', 'degraded', 'down']),
      latency: z.number().optional(),
    }),
  ),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

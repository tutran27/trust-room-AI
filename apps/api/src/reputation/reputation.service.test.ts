import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReputationService } from './reputation.service';

/**
 * In-memory prisma double for the single Reputation row keyed by wallet. Lets us
 * assert that volume actually accumulates and shifts the recalculated score —
 * the bug being fixed was that addVolume() was never called, so totalVolume (and
 * thus the volume bonus) stayed at 0.
 */
function buildService(initial?: Record<string, unknown>) {
  const row: Record<string, unknown> = {
    wallet: 'w1',
    completedDeals: 0,
    successfulDeals: 0,
    disputedDeals: 0,
    totalVolume: 0,
    score: 0,
    lastUpdated: new Date(),
    ...initial,
  };

  const prisma = {
    reputation: {
      findUnique: vi.fn(async () => row),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(row, data);
        return row;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        for (const [key, value] of Object.entries(data)) {
          if (value && typeof value === 'object' && 'increment' in (value as object)) {
            row[key] = Number(row[key] ?? 0) + Number((value as { increment: number }).increment);
          } else {
            row[key] = value;
          }
        }
        return row;
      }),
    },
  };

  return { service: new ReputationService(prisma as never), prisma, row };
}

describe('ReputationService', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('accumulates volume via addVolume', async () => {
    await ctx.service.addVolume('w1', 5000);
    expect(Number(ctx.row.totalVolume)).toBe(5000);
    await ctx.service.addVolume('w1', 5000);
    expect(Number(ctx.row.totalVolume)).toBe(10000);
  });

  it('volume bonus raises the score (caps at +0.2)', async () => {
    // One successful deal → successRate 1, no disputes.
    ctx.row.completedDeals = 1;
    ctx.row.successfulDeals = 1;

    await ctx.service.recalculateScore('w1');
    const withoutVolume = Number(ctx.row.score);
    expect(withoutVolume).toBeCloseTo(1, 5); // already capped at 1

    // Now drop success rate so the volume bonus is observable below the cap.
    ctx.row.completedDeals = 2;
    ctx.row.successfulDeals = 1; // successRate 0.5
    await ctx.service.recalculateScore('w1');
    const noVolumeScore = Number(ctx.row.score);

    await ctx.service.addVolume('w1', 1000); // bonus = min(1000/10000,0.2)=0.1
    await ctx.service.recalculateScore('w1');
    const withVolumeScore = Number(ctx.row.score);

    expect(withVolumeScore).toBeGreaterThan(noVolumeScore);
    expect(withVolumeScore).toBeCloseTo(0.6, 5);
  });
});

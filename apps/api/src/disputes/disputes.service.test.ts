import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DisputeResolution, DisputeStatus } from '@trustroom/db';
import { DealStatus } from '@trustroom/types';
import { DisputesService } from './disputes.service';
import { hashEvidence, hashEvidenceBundle, resolutionToDealStatus } from './disputes.utils';

/**
 * These tests drive DisputesService against an in-memory prisma double and a
 * stubbed DealsService. They verify the security-critical behavior: only deal
 * participants may resolve a dispute, and resolving drives the deal FSM.
 */

const PARTICIPANT = 'BuyerWallet1111111111111111111111111111111';
const SELLER = 'SellerWallet111111111111111111111111111111';
const OUTSIDER = 'OutsiderWallet1111111111111111111111111111';

function makeDispute(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dispute_1',
    dealId: 'deal_1',
    raisedBy: PARTICIPANT,
    reason: 'no delivery',
    status: DisputeStatus.Open,
    resolution: null,
    aiSummary: null,
    resolvedAt: null,
    deal: {
      id: 'deal_1',
      status: DealStatus.Disputed,
      participants: [
        { walletAddress: PARTICIPANT, role: 'buyer' },
        { walletAddress: SELLER, role: 'seller' },
      ],
    },
    evidence: [
      { id: 'ev_1', content: 'proof', url: null, hash: hashEvidence('proof', null) },
    ],
    ...overrides,
  };
}

function buildService() {
  const dealUpdate = vi.fn().mockResolvedValue({});
  const prisma = {
    dispute: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    deal: {
      update: dealUpdate,
    },
    dealParticipant: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const ws = { emitDisputeUpdate: vi.fn(), emitNotification: vi.fn() };
  const notifications = { create: vi.fn().mockResolvedValue({ id: 'n', createdAt: new Date() }) };
  const deals = { settleDisputedDeal: vi.fn().mockResolvedValue({}) };

  const service = new DisputesService(
    prisma as never,
    ws as never,
    notifications as never,
    deals as never,
  );
  return { service, prisma, ws, notifications, deals };
}

describe('DisputesService.resolveDispute', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  it('rejects a non-participant with FORBIDDEN', async () => {
    ctx.prisma.dispute.findUnique.mockResolvedValue(makeDispute());

    await expect(
      ctx.service.resolveDispute(OUTSIDER, 'dispute_1', { resolution: 'ReleaseToSeller' }),
    ).rejects.toMatchObject({ status: 403 });

    expect(ctx.prisma.dispute.update).not.toHaveBeenCalled();
    expect(ctx.deals.settleDisputedDeal).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when dispute does not exist', async () => {
    ctx.prisma.dispute.findUnique.mockResolvedValue(null);

    await expect(
      ctx.service.resolveDispute(PARTICIPANT, 'missing', { resolution: 'RefundToBuyer' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects re-resolving an already resolved dispute', async () => {
    ctx.prisma.dispute.findUnique.mockResolvedValue(
      makeDispute({ status: DisputeStatus.Resolved }),
    );

    await expect(
      ctx.service.resolveDispute(PARTICIPANT, 'dispute_1', { resolution: 'SplitPayment' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('resolves and drives the deal FSM to the matching terminal state', async () => {
    ctx.prisma.dispute.findUnique.mockResolvedValue(makeDispute());
    ctx.prisma.dispute.update.mockResolvedValue({
      id: 'dispute_1',
      dealId: 'deal_1',
      status: DisputeStatus.Resolved,
      resolution: DisputeResolution.ReleaseToSeller,
    });

    await ctx.service.resolveDispute(PARTICIPANT, 'dispute_1', {
      resolution: 'ReleaseToSeller',
    });

    expect(ctx.prisma.dispute.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DisputeStatus.Resolved,
          resolution: DisputeResolution.ReleaseToSeller,
        }),
      }),
    );
    expect(ctx.deals.settleDisputedDeal).toHaveBeenCalledWith(
      'deal_1',
      resolutionToDealStatus(DisputeResolution.ReleaseToSeller),
      PARTICIPANT,
    );
  });

  it('anchors the evidence bundle hash onto the deal', async () => {
    const dispute = makeDispute();
    ctx.prisma.dispute.findUnique.mockResolvedValue(dispute);
    ctx.prisma.dispute.update.mockResolvedValue({
      id: 'dispute_1',
      dealId: 'deal_1',
      status: DisputeStatus.Resolved,
      resolution: DisputeResolution.RefundToBuyer,
    });

    await ctx.service.resolveDispute(PARTICIPANT, 'dispute_1', {
      resolution: 'RefundToBuyer',
    });

    const expected = hashEvidenceBundle(dispute.evidence.map((e) => e.hash));
    expect(ctx.prisma.deal.update).toHaveBeenCalledWith({
      where: { id: 'deal_1' },
      data: { evidenceHash: expected },
    });
  });
});

import { describe, expect, it } from 'vitest';
import { analyzeMessageSync } from './analyze.js';
import { parseWalletsAndLinks } from './wallet-parser.js';
import { scoreWalletRisk } from './wallet-risk.js';

/**
 * Covers the five demo scam scenarios from AI_SCAM_DETECT_PLAN.md §12 plus the
 * multi-layer aggregation behavior that distinguishes the full engine from the
 * old keyword-only detector.
 */
describe('Scam Guard — full-context analyzer', () => {
  // Test case 1 — early release before delivery proof.
  it('flags early-release before delivery as high risk and locks release', () => {
    const r = analyzeMessageSync({
      message: 'Bạn release trước đi rồi tôi gửi file ngay.',
      dealStatus: 'Deposited',
      speakerRole: 'seller',
    });
    expect(r.intents).toContain('early_release_request');
    expect(['high', 'critical']).toContain(r.finalLevel);
    expect(r.lockRelease).toBe(true);
  });

  // Test case 2 — luring off-platform.
  it('flags moving off-platform', () => {
    const r = analyzeMessageSync({
      message: 'Qua Telegram nói chuyện cho tiện, ở đây chậm quá.',
      dealStatus: 'Negotiating',
      speakerRole: 'seller',
    });
    expect(r.intents).toContain('move_off_platform');
    expect(['high', 'critical']).toContain(r.finalLevel);
  });

  // Test case 3 — external wallet address (the rule the old engine never fired).
  it('flags an external wallet address as critical and locks release', () => {
    const r = analyzeMessageSync({
      message: 'Escrow lỗi rồi, bạn gửi vào ví này nhé: 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
      dealStatus: 'Deposited',
      speakerRole: 'seller',
      knownAddresses: ['So11111111111111111111111111111111111111112'],
    });
    expect(r.intents).toContain('external_wallet');
    expect(r.finalLevel).toBe('critical');
    expect(r.lockRelease).toBe(true);
  });

  it('does NOT flag a wallet address that belongs to the deal', () => {
    const known = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
    const r = analyzeMessageSync({
      message: `Gửi vào escrow ${known} nhé`,
      dealStatus: 'Deposited',
      knownAddresses: [known],
    });
    expect(r.intents).not.toContain('external_wallet');
  });

  // Test case 4 — fake payment proof pressure.
  it('flags fake payment proof pressure', () => {
    const r = analyzeMessageSync({
      message: 'Tôi chuyển rồi, bill đây, release NFT đi.',
      dealStatus: 'Deposited',
      speakerRole: 'buyer',
      evidence: [{ kind: 'screenshot', verified: false }],
    });
    expect(r.intents).toContain('fake_payment_proof');
    expect(r.evidenceRisk).toBeGreaterThan(0);
    expect(['high', 'critical']).toContain(r.finalLevel);
  });

  // Test case 5 — credential request.
  it('treats credential requests as critical and blocks the message', () => {
    const r = analyzeMessageSync({
      message: 'Gửi seed phrase để tôi kiểm tra ví giúp bạn.',
      dealStatus: 'Negotiating',
      speakerRole: 'seller',
    });
    expect(r.intents).toContain('credential_request');
    expect(r.finalLevel).toBe('critical');
    expect(r.blockMessage).toBe(true);
  });

  it('catches paraphrased early-release via regex (no exact keyword)', () => {
    const r = analyzeMessageSync({
      message: 'Cứ bấm hoàn tất trước đi, mình giao ngay sau đó.',
      dealStatus: 'Negotiating',
    });
    expect(r.intents).toContain('early_release_request');
  });

  it('compounds risk with wallet profile + repetition', () => {
    const base = analyzeMessageSync({
      message: 'nhanh lên gấp đi, chỉ còn 5 phút thôi',
      dealStatus: 'Negotiating',
    });
    const compounded = analyzeMessageSync({
      message: 'nhanh lên gấp đi, chỉ còn 5 phút thôi',
      dealStatus: 'Negotiating',
      walletProfile: { walletAgeDays: 2, completedDeals: 0, isReportedWallet: true },
      priorIntents: ['time_pressure', 'time_pressure'],
    });
    expect(compounded.finalScore).toBeGreaterThan(base.finalScore);
    expect(compounded.walletRisk).toBeGreaterThan(0);
    expect(compounded.repetitionPenalty).toBeGreaterThan(0);
  });

  it('returns a clean low verdict for a benign message', () => {
    const r = analyzeMessageSync({
      message: 'Cảm ơn bạn, mình sẽ kiểm tra file rồi xác nhận nhé.',
      dealStatus: 'DeliverySubmitted',
    });
    expect(r.signals).toHaveLength(0);
    expect(r.finalLevel).toBe('low');
    expect(r.lockRelease).toBe(false);
  });

  it('does not flag early-release once delivery is submitted', () => {
    const r = analyzeMessageSync({
      message: 'ok bạn release đi',
      dealStatus: 'DeliverySubmitted',
    });
    expect(r.intents).not.toContain('early_release_request');
  });
  it('flags Vietnamese requests to move to another app and avoid escrow', () => {
    const r = analyzeMessageSync({
      message: 'Mình chuyển qua app khác nói chuyện riêng nhé, không cần escrow ở đây đâu.',
      dealStatus: 'Deposited',
      speakerRole: 'seller',
    });
    expect(r.intents).toContain('move_off_platform');
    expect(['high', 'critical']).toContain(r.finalLevel);
    expect(r.lockRelease).toBe(true);
  });
});

describe('Wallet/link parser', () => {
  it('separates known from external addresses', () => {
    const known = 'So11111111111111111111111111111111111111112';
    const external = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
    const r = parseWalletsAndLinks({
      text: `gửi ${external} thay vì ${known}`,
      knownAddresses: [known],
    });
    expect(r.externalAddresses).toContain(external);
    expect(r.externalAddresses).not.toContain(known);
  });

  it('flags URL shorteners and wallet-connect lures', () => {
    const r = parseWalletsAndLinks({
      text: 'claim airdrop tại https://bit.ly/abcd và https://solana-connect.xyz/verify',
    });
    expect(r.suspiciousUrls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Wallet risk engine', () => {
  it('scores a fresh, reported, no-history wallet as high risk', () => {
    const r = scoreWalletRisk({
      walletAgeDays: 1,
      completedDeals: 0,
      txCount: 2,
      isReportedWallet: true,
    });
    expect(r.score).toBeGreaterThanOrEqual(50);
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('returns zero for an empty/unknown profile', () => {
    expect(scoreWalletRisk(undefined).score).toBe(0);
    expect(scoreWalletRisk({}).score).toBe(0);
  });
});

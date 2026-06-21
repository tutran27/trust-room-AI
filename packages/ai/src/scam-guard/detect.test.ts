import { describe, expect, it } from 'vitest';
import {
  aggregateRisk,
  aggregateFullRisk,
  repetitionPenalty,
  runRules,
} from './detect.js';
import {
  extractSolanaAddresses,
  findExternalAddresses,
  isValidSolanaAddress,
} from './wallet.js';
import type { RuleHit } from './detect.js';
import { SCAM_RULES } from './rules.js';

// Real Solana addresses (decode to 32 bytes) used as fixtures.
const WSOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const OTHER = '4Nd1mBQtrMJVYVfKf2PJy9NZUZdTAsp7D4xWLs4gDB4T';

function hitFor(ruleId: string): RuleHit {
  const rule = SCAM_RULES.find((r) => r.ruleId === ruleId)!;
  return { rule, matchedKeyword: null };
}

describe('Scam Guard rules', () => {
  it('flags an early-release request (Vietnamese) before delivery as high risk', () => {
    const hits = runRules('Bạn release trước đi rồi tôi gửi file sau', 'Negotiating');
    const ids = hits.map((h) => h.rule.ruleId);
    expect(ids).toContain('EARLY_RELEASE');
    const assessment = aggregateRisk(hits);
    expect(assessment.level === 'high' || assessment.level === 'critical').toBe(true);
  });

  it('treats credential requests as critical', () => {
    const hits = runRules('cho mình xin seed phrase với', 'Deposited');
    expect(aggregateRisk(hits).level).toBe('critical');
  });

  it('does not flag early-release once delivery is submitted', () => {
    const hits = runRules('ok bạn release đi', 'DeliverySubmitted');
    expect(hits.map((h) => h.rule.ruleId)).not.toContain('EARLY_RELEASE');
  });

  it('flags off-platform moves', () => {
    const hits = runRules('mình nói chuyện qua Telegram cho nhanh', 'Negotiating');
    expect(hits.map((h) => h.rule.ruleId)).toContain('OFF_PLATFORM');
  });
});

describe('Solana wallet parsing', () => {
  it('validates real addresses and rejects non-32-byte look-alikes', () => {
    expect(isValidSolanaAddress(WSOL)).toBe(true);
    expect(isValidSolanaAddress(USDC)).toBe(true);
    // base58 but too short / not 32 bytes:
    expect(isValidSolanaAddress('helloeveryonethisisatestmessage1')).toBe(false);
    // contains non-base58 chars (0, O, l):
    expect(isValidSolanaAddress('0OOl0OOl0OOl0OOl0OOl0OOl0OOl0OOl0OOl')).toBe(false);
  });

  it('extracts addresses from free text, de-duplicated', () => {
    const found = extractSolanaAddresses(
      `gửi tới ${USDC} hoặc lại ${USDC} cũng được, còn ${OTHER} thì thôi`,
    );
    expect(found).toEqual([USDC, OTHER]);
  });

  it('finds addresses that are not part of the deal', () => {
    const external = findExternalAddresses(`chuyển sang ${OTHER} nhé`, [WSOL, USDC]);
    expect(external).toEqual([OTHER]);
  });

  it('returns no external address when all referenced wallets belong to the deal', () => {
    expect(findExternalAddresses(`ví escrow là ${WSOL}`, [WSOL, USDC])).toEqual([]);
  });
});

describe('EXTERNAL_WALLET rule integration', () => {
  it('does not fire when no known wallets are supplied (backward-compatible)', () => {
    const hits = runRules(`gửi tiền tới ${OTHER}`, 'Negotiating');
    expect(hits.map((h) => h.rule.ruleId)).not.toContain('EXTERNAL_WALLET');
  });

  it('fires when an address outside the deal wallets is referenced', () => {
    const hits = runRules(`gửi tiền tới ${OTHER}`, 'Negotiating', [WSOL, USDC]);
    expect(hits.map((h) => h.rule.ruleId)).toContain('EXTERNAL_WALLET');
    expect(aggregateRisk(hits).level).toBe('critical');
  });

  it('does not fire when only deal wallets are referenced', () => {
    const hits = runRules(`ví của mình là ${WSOL}`, 'Negotiating', [WSOL, USDC]);
    expect(hits.map((h) => h.rule.ruleId)).not.toContain('EXTERNAL_WALLET');
  });
});

describe('repetition penalty', () => {
  it('is zero for a first-time intent', () => {
    expect(repetitionPenalty(['early_release_request'], [])).toBe(0);
  });

  it('scales with repeats of the same dangerous intent', () => {
    // 1 prior + 1 current = 2 occurrences → 1 repeat → 10
    expect(
      repetitionPenalty(['move_off_platform'], ['move_off_platform']),
    ).toBe(10);
    expect(
      repetitionPenalty(['move_off_platform'], ['move_off_platform', 'move_off_platform']),
    ).toBe(20);
  });

  it('caps the penalty per intent and overall', () => {
    const many = Array.from({ length: 20 }, () => 'time_pressure' as const);
    // per-intent cap is 30
    expect(repetitionPenalty(['time_pressure'], many)).toBe(30);
    // overall cap is 40 across multiple intents
    const total = repetitionPenalty(
      ['time_pressure', 'move_off_platform'],
      [...many, ...Array.from({ length: 20 }, () => 'move_off_platform' as const)],
    );
    expect(total).toBe(40);
  });

  it('ignores intents not in the repeatable set', () => {
    expect(
      repetitionPenalty(['ambiguous_terms'], ['ambiguous_terms', 'ambiguous_terms']),
    ).toBe(0);
  });
});

describe('full risk aggregator', () => {
  it('sums all components and caps at 100', () => {
    const hits = [hitFor('OFF_PLATFORM')]; // conversation 35
    const result = aggregateFullRisk({
      conversationHits: hits,
      walletRisk: 10,
      escrowStateRisk: 0,
      evidenceRisk: 20,
      repetitionPenalty: 10,
    });
    expect(result.score).toBe(75);
    expect(result.components).toEqual({
      conversationRisk: 35,
      walletRisk: 10,
      escrowStateRisk: 0,
      evidenceRisk: 20,
      repetitionPenalty: 10,
    });
    expect(result.level).toBe('high');
  });

  it('caps a large cumulative score at 100 and reports critical', () => {
    const hits = [hitFor('CREDENTIAL_REQUEST')]; // 100 + critical
    const result = aggregateFullRisk({
      conversationHits: hits,
      walletRisk: 35,
      repetitionPenalty: 40,
    });
    expect(result.score).toBe(100);
    expect(result.level).toBe('critical');
  });

  it('keeps a critical rule level even when the score lands in a lower band', () => {
    // external wallet rule is critical-severity at 80, but suppose only partial — use a
    // single high-severity rule with extra components landing below its severity band.
    const hits = [hitFor('EXTERNAL_WALLET')]; // critical, 80
    const result = aggregateFullRisk({ conversationHits: hits });
    expect(result.level).toBe('critical');
  });

  it('defaults all optional components to zero', () => {
    const result = aggregateFullRisk({ conversationHits: [hitFor('TIME_PRESSURE')] });
    expect(result.score).toBe(20);
    expect(result.components.repetitionPenalty).toBe(0);
    expect(result.components.walletRisk).toBe(0);
  });
});

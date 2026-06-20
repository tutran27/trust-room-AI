import { describe, expect, it } from 'vitest';
import { aggregateRisk, runRules } from './detect.js';

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

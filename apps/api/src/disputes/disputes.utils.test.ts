import { describe, expect, it } from 'vitest';
import { DisputeResolution } from '@trustroom/db';
import { DealStatus } from '@trustroom/types';
import {
  canonicalizeEvidence,
  hashEvidence,
  hashEvidenceBundle,
  resolutionToDealStatus,
} from './disputes.utils';

describe('disputes.utils', () => {
  it('produces a non-null deterministic sha256 hex digest for evidence', () => {
    const hash = hashEvidence('payment proof', 'https://example.com/p.png');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEvidence('payment proof', 'https://example.com/p.png')).toBe(hash);
  });

  it('canonicalizes whitespace and unicode form so equivalent inputs hash equally', () => {
    expect(canonicalizeEvidence('  hello\r\nworld  ')).toBe(
      canonicalizeEvidence('hello\nworld'),
    );
    expect(hashEvidence('  abc  ')).toBe(hashEvidence('abc'));
  });

  it('treats content/url boundary unambiguously', () => {
    // ("ab","c") must not collide with ("a","bc")
    expect(hashEvidence('ab', 'c')).not.toBe(hashEvidence('a', 'bc'));
  });

  it('handles a missing url without throwing', () => {
    expect(hashEvidence('only content')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEvidence('only content', null)).toBe(hashEvidence('only content'));
  });

  it('bundles evidence hashes order-independently and skips nulls', () => {
    const a = hashEvidence('a');
    const b = hashEvidence('b');
    expect(hashEvidenceBundle([a, b])).toBe(hashEvidenceBundle([b, a]));
    expect(hashEvidenceBundle([a, null, b, undefined])).toBe(hashEvidenceBundle([b, a]));
    expect(hashEvidenceBundle([])).toBeNull();
    expect(hashEvidenceBundle([null, undefined])).toBeNull();
  });

  it('maps each resolution to its terminal deal status', () => {
    expect(resolutionToDealStatus(DisputeResolution.ReleaseToSeller)).toBe(
      DealStatus.ResolvedRelease,
    );
    expect(resolutionToDealStatus(DisputeResolution.RefundToBuyer)).toBe(
      DealStatus.ResolvedRefund,
    );
    expect(resolutionToDealStatus(DisputeResolution.SplitPayment)).toBe(
      DealStatus.ResolvedSplit,
    );
  });
});

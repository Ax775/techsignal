import { describe, expect, it } from 'vitest';
import { generatePitch, type PitchRequest } from '../services/ai-pitch';
import type { ChangeType } from '../types/domain';

function req(overrides: Partial<PitchRequest> = {}): PitchRequest {
  return {
    domain: 'acme.com',
    companyName: 'Acme Corp',
    changeType: 'churn',
    techInvolved: 'HubSpot',
    description: 'HubSpot is no longer detected.',
    ...overrides,
  };
}

const TYPES: ChangeType[] = ['churn', 'adoption', 'vulnerability'];

describe('generatePitch', () => {
  it('returns a string for churn event', async () => {
    const pitch = await generatePitch(req({ changeType: 'churn' }));
    expect(typeof pitch).toBe('string');
  });

  it('returns a string for adoption event', async () => {
    const pitch = await generatePitch(req({ changeType: 'adoption' }));
    expect(typeof pitch).toBe('string');
  });

  it('returns a string for vulnerability event', async () => {
    const pitch = await generatePitch(req({ changeType: 'vulnerability' }));
    expect(typeof pitch).toBe('string');
  });

  it('includes domain name in the pitch', async () => {
    for (const changeType of TYPES) {
      const pitch = await generatePitch(req({ changeType, domain: 'shop.example' }));
      expect(pitch).toContain('shop.example');
    }
  });

  it('includes tech name in the pitch', async () => {
    for (const changeType of TYPES) {
      const pitch = await generatePitch(req({ changeType, techInvolved: 'Magento' }));
      expect(pitch).toContain('Magento');
    }
  });

  it('pitch is >= 100 characters (not empty)', async () => {
    for (const changeType of TYPES) {
      const pitch = await generatePitch(req({ changeType }));
      expect(pitch.length).toBeGreaterThanOrEqual(100);
    }
  });

  it('pitch contains a subject line', async () => {
    for (const changeType of TYPES) {
      const pitch = await generatePitch(req({ changeType }));
      expect(pitch).toContain('Subject:');
    }
  });

  it('different inputs produce different pitches', async () => {
    const churn = await generatePitch(req({ changeType: 'churn' }));
    const adoption = await generatePitch(req({ changeType: 'adoption' }));
    const vuln = await generatePitch(req({ changeType: 'vulnerability' }));
    expect(new Set([churn, adoption, vuln]).size).toBe(3);

    // Different tech in the same change type also diverges.
    const a = await generatePitch(req({ changeType: 'adoption', techInvolved: 'Shopify' }));
    const b = await generatePitch(req({ changeType: 'adoption', techInvolved: 'Magento' }));
    expect(a).not.toBe(b);
  });

  it('falls back to the domain when company name is missing', async () => {
    const pitch = await generatePitch(req({ companyName: null, domain: 'nameless.io' }));
    expect(pitch).toContain('nameless.io');
  });

  it('still returns a template when an apiKey is supplied (mock LLM path)', async () => {
    const pitch = await generatePitch(req({ changeType: 'adoption' }), 'fake-api-key');
    expect(typeof pitch).toBe('string');
    expect(pitch.length).toBeGreaterThanOrEqual(100);
  });
});

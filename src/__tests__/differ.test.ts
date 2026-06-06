import { describe, expect, it } from 'vitest';
import { emptyTechStack, type TechStack } from '../types/domain';
import { detectVulnerabilitySignals, diffTechStacks } from '../services/differ';

function stackWith(parts: Partial<TechStack>): TechStack {
  return { ...emptyTechStack(), ...parts };
}

describe('diffTechStacks', () => {
  it('returns empty array when stacks are identical', () => {
    const a = stackWith({ ecommerce: ['Shopify'], martech: ['HubSpot'] });
    const b = stackWith({ ecommerce: ['Shopify'], martech: ['HubSpot'] });
    expect(diffTechStacks(a, b)).toEqual([]);
  });

  it('returns adoption event when new tech appears', () => {
    const prev = emptyTechStack();
    const curr = stackWith({ martech: ['HubSpot'] });
    const events = diffTechStacks(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'adoption', tech: 'HubSpot', category: 'martech' });
  });

  it('returns churn event when tech disappears', () => {
    const prev = stackWith({ martech: ['HubSpot'] });
    const curr = emptyTechStack();
    const events = diffTechStacks(prev, curr);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'churn', tech: 'HubSpot', category: 'martech' });
  });

  it('returns both churn and adoption when tech switches (WooCommerce → Shopify)', () => {
    const prev = stackWith({ ecommerce: ['WooCommerce'] });
    const curr = stackWith({ ecommerce: ['Shopify'] });
    const events = diffTechStacks(prev, curr);
    expect(events).toHaveLength(2);

    const adoption = events.find((e) => e.type === 'adoption');
    const churn = events.find((e) => e.type === 'churn');
    expect(adoption?.tech).toBe('Shopify');
    expect(churn?.tech).toBe('WooCommerce');
  });

  it('handles completely empty previous stack (first scan)', () => {
    const prev = emptyTechStack();
    const curr = stackWith({ ecommerce: ['Shopify'], infrastructure: ['Cloudflare'] });
    const events = diffTechStacks(prev, curr);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === 'adoption')).toBe(true);
    expect(events.map((e) => e.tech).sort()).toEqual(['Cloudflare', 'Shopify']);
  });

  it('handles completely empty current stack (all tech removed)', () => {
    const prev = stackWith({ ecommerce: ['Shopify'], infrastructure: ['Cloudflare'] });
    const curr = emptyTechStack();
    const events = diffTechStacks(prev, curr);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === 'churn')).toBe(true);
  });

  it('handles multiple simultaneous changes', () => {
    const prev = stackWith({ ecommerce: ['WooCommerce'], martech: ['Hotjar'] });
    const curr = stackWith({ ecommerce: ['Shopify'], martech: ['Hotjar', 'HubSpot'] });
    const events = diffTechStacks(prev, curr);
    // churn WooCommerce, adoption Shopify, adoption HubSpot. Hotjar unchanged.
    expect(events).toHaveLength(3);
    const adoptions = events.filter((e) => e.type === 'adoption').map((e) => e.tech).sort();
    const churns = events.filter((e) => e.type === 'churn').map((e) => e.tech);
    expect(adoptions).toEqual(['HubSpot', 'Shopify']);
    expect(churns).toEqual(['WooCommerce']);
  });

  it('returns correct tech name in change event', () => {
    const events = diffTechStacks(emptyTechStack(), stackWith({ analytics: ['Segment'] }));
    expect(events[0]!.tech).toBe('Segment');
  });

  it('returns correct change type', () => {
    const adoption = diffTechStacks(emptyTechStack(), stackWith({ cms: ['WordPress'] }));
    const churn = diffTechStacks(stackWith({ cms: ['WordPress'] }), emptyTechStack());
    expect(adoption[0]!.type).toBe('adoption');
    expect(churn[0]!.type).toBe('churn');
  });
});

describe('detectVulnerabilitySignals', () => {
  it('flags Magento without Cloudflare as vulnerability', () => {
    const stack = stackWith({ ecommerce: ['Magento'] });
    const events = detectVulnerabilitySignals(stack);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'vulnerability', tech: 'Magento' });
  });

  it('does NOT flag Shopify as vulnerability', () => {
    const stack = stackWith({ ecommerce: ['Shopify'], infrastructure: ['Cloudflare'] });
    expect(detectVulnerabilitySignals(stack)).toEqual([]);
  });

  it('does NOT flag Magento WITH Cloudflare as vulnerability', () => {
    const stack = stackWith({ ecommerce: ['Magento'], infrastructure: ['Cloudflare'] });
    expect(detectVulnerabilitySignals(stack)).toEqual([]);
  });

  it('returns empty array for safe stack', () => {
    const stack = stackWith({ ecommerce: ['Shopify'], infrastructure: ['Cloudflare'], martech: ['HubSpot'] });
    expect(detectVulnerabilitySignals(stack)).toEqual([]);
  });
});

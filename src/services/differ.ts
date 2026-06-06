import {
  TECH_CATEGORIES,
  type ChangeEvent,
  type TechCategory,
  type TechStack,
} from '../types/domain';

/**
 * Compare two tech stacks category-by-category and emit change events.
 *  - 'adoption': present in curr but not in prev.
 *  - 'churn':    present in prev but not in curr.
 */
export function diffTechStacks(
  prev: TechStack,
  curr: TechStack,
): ChangeEvent[] {
  const events: ChangeEvent[] = [];

  for (const cat of TECH_CATEGORIES) {
    const prevSet = new Set(prev[cat]);
    const currSet = new Set(curr[cat]);

    for (const tech of currSet) {
      if (!prevSet.has(tech)) {
        events.push({
          type: 'adoption',
          tech,
          category: cat,
          from: prev,
          to: curr,
          description: `${tech} (${cat}) was newly detected on the site.`,
        });
      }
    }

    for (const tech of prevSet) {
      if (!currSet.has(tech)) {
        events.push({
          type: 'churn',
          tech,
          category: cat,
          from: prev,
          to: curr,
          description: `${tech} (${cat}) is no longer detected — likely removed or replaced.`,
        });
      }
    }
  }

  return events;
}

interface VulnRule {
  /** Returns true when the (unsafe) condition is met. */
  test: (stack: TechStack) => boolean;
  tech: string;
  category: TechCategory;
  description: string;
}

const VULN_RULES: VulnRule[] = [
  {
    // Magento storefronts without an edge/WAF in front are a classic
    // Magecart / card-skimming risk surface.
    test: (s) =>
      s.ecommerce.includes('Magento') &&
      !s.infrastructure.includes('Cloudflare'),
    tech: 'Magento',
    category: 'ecommerce',
    description:
      'Magento detected without a Cloudflare edge/WAF — elevated exposure to Magecart-style skimming and unpatched-CVE exploitation.',
  },
  {
    // WooCommerce on bare WordPress with no CDN/WAF is similarly exposed.
    test: (s) =>
      s.ecommerce.includes('WooCommerce') &&
      s.infrastructure.length === 0,
    tech: 'WooCommerce',
    category: 'ecommerce',
    description:
      'WooCommerce running with no detectable CDN/WAF layer — checkout flow is directly exposed to origin.',
  },
];

/**
 * Heuristic vulnerability/risk signals derivable from the current stack alone
 * (no prior snapshot required). Stays strictly technographic — no scanning of
 * the target beyond what was already fetched.
 */
export function detectVulnerabilitySignals(stack: TechStack): ChangeEvent[] {
  const events: ChangeEvent[] = [];
  for (const rule of VULN_RULES) {
    if (rule.test(stack)) {
      events.push({
        type: 'vulnerability',
        tech: rule.tech,
        category: rule.category,
        to: stack,
        description: rule.description,
      });
    }
  }
  return events;
}

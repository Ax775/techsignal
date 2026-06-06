import {
  emptyTechStack,
  type TechCategory,
  type TechStack,
} from '../types/domain';

// ---------------------------------------------------------------------------
// Technographic signature matching.
//
// Detection is purely structural: we match on script srcs, inline init calls,
// CDN hosts and response headers. We deliberately DO NOT extract email
// addresses, personal names, phone numbers or any other PII — only the
// presence of a technology is recorded (GDPR-safe technographics).
// ---------------------------------------------------------------------------

export interface TechSignature {
  /** Human-readable tech name used everywhere downstream. */
  name: string;
  category: TechCategory;
  /** Patterns matched against the HTML body. */
  patterns: RegExp[];
  /** Patterns matched against the concatenated response headers. */
  headerPatterns?: RegExp[];
}

export const TECH_SIGNATURES: Record<string, TechSignature> = {
  // -------------------- ECOMMERCE --------------------
  shopify: {
    name: 'Shopify',
    category: 'ecommerce',
    patterns: [/cdn\.shopify\.com|Shopify\.theme|shopify-features/i],
    headerPatterns: [/shopify/i],
  },
  woocommerce: {
    name: 'WooCommerce',
    category: 'ecommerce',
    patterns: [/woocommerce|wp-content\/plugins\/woocommerce/i],
  },
  magento: {
    name: 'Magento',
    category: 'ecommerce',
    patterns: [/Mage\.Cookies|mage\/cookies|magento/i],
    headerPatterns: [/magento/i],
  },
  shopware: {
    name: 'Shopware',
    category: 'ecommerce',
    patterns: [/shopware\/storefront|\/shopware\//i],
  },

  // -------------------- MARTECH --------------------
  hubspot: {
    name: 'HubSpot',
    category: 'martech',
    patterns: [/hs-scripts\.com|hubspot\.com\/hs-sites|_hsq\s*=/i],
  },
  ga4: {
    name: 'Google Analytics 4',
    category: 'martech',
    patterns: [/gtag\('config',\s*'G-|google-analytics\.com\/analytics\.js/i],
  },
  hotjar: {
    name: 'Hotjar',
    category: 'martech',
    patterns: [/static\.hotjar\.com|hj\('sv'|hjid:/i],
  },
  klaviyo: {
    name: 'Klaviyo',
    category: 'martech',
    patterns: [/static\.klaviyo\.com|klaviyo\.init/i],
  },

  // -------------------- INFRASTRUCTURE (header-driven) --------------------
  cloudflare: {
    name: 'Cloudflare',
    category: 'infrastructure',
    patterns: [/__cf_bm|cloudflare/i],
    headerPatterns: [/cloudflare/i, /cf-ray/i],
  },
  aws: {
    name: 'AWS',
    category: 'infrastructure',
    patterns: [],
    headerPatterns: [/Amazon|AWS/i, /x-amz/i],
  },
  digitalocean: {
    name: 'DigitalOcean',
    category: 'infrastructure',
    patterns: [/digitalocean/i],
    headerPatterns: [/digitalocean/i],
  },

  // -------------------- ANALYTICS --------------------
  segment: {
    name: 'Segment',
    category: 'analytics',
    patterns: [/cdn\.segment\.com|analytics\.js/i],
  },
  mixpanel: {
    name: 'Mixpanel',
    category: 'analytics',
    patterns: [/cdn\.mxpnl\.com|mixpanel\.init/i],
  },

  // -------------------- CMS --------------------
  wordpress: {
    name: 'WordPress',
    category: 'cms',
    patterns: [/wp-content\/(?!plugins\/woocommerce)|wp-includes|wp-json/i],
    headerPatterns: [/wordpress/i],
  },
  drupal: {
    name: 'Drupal',
    category: 'cms',
    patterns: [/Drupal\.settings|sites\/all\/|\/sites\/default\/files/i],
    headerPatterns: [/drupal/i],
  },
  contentful: {
    name: 'Contentful',
    category: 'cms',
    patterns: [/cdn\.contentful\.com|images\.ctfassets\.net/i],
  },
};

function headersBlob(headers: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`${k}: ${v}`);
  }
  return parts.join('\n');
}

function pushUnique(arr: string[], value: string): void {
  if (!arr.includes(value)) arr.push(value);
}

/**
 * Parse a categorized TechStack from a page body + response headers.
 */
export function parseTechStack(
  html: string,
  headers: Record<string, string>,
): TechStack {
  const stack = emptyTechStack();
  const body = html ?? '';
  const headerStr = headersBlob(headers ?? {});

  for (const sig of Object.values(TECH_SIGNATURES)) {
    let matched = false;

    for (const pattern of sig.patterns) {
      if (pattern.test(body)) {
        matched = true;
        break;
      }
    }

    if (!matched && sig.headerPatterns) {
      for (const hp of sig.headerPatterns) {
        if (hp.test(headerStr)) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      pushUnique(stack[sig.category], sig.name);
    }
  }

  // Deterministic ordering within each category.
  for (const cat of Object.keys(stack) as TechCategory[]) {
    stack[cat].sort((a, b) => a.localeCompare(b));
  }

  return stack;
}

/**
 * Flatten a TechStack into a sorted, de-duplicated array of tech names.
 * Used for hashing the signature and for diffing across snapshots.
 */
export function techStackToSignature(stack: TechStack): string[] {
  const all = new Set<string>();
  for (const cat of Object.keys(stack) as TechCategory[]) {
    for (const tech of stack[cat]) all.add(tech);
  }
  return Array.from(all).sort((a, b) => a.localeCompare(b));
}

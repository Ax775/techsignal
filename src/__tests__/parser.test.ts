import { describe, expect, it } from 'vitest';
import { emptyTechStack, type TechStack } from '../types/domain';
import { parseTechStack, techStackToSignature } from '../services/parser';

const NO_HEADERS: Record<string, string> = {};

function flat(stack: TechStack): string[] {
  return techStackToSignature(stack);
}

describe('parseTechStack', () => {
  // ------------------------- Shopify -------------------------
  it('detects Shopify from CDN script tag', () => {
    const html = '<script src="https://cdn.shopify.com/s/files/app.js"></script>';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.ecommerce).toContain('Shopify');
  });

  it('detects Shopify from theme variable', () => {
    const html = '<script>var theme = Shopify.theme = { name: "Dawn" };</script>';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.ecommerce).toContain('Shopify');
  });

  it('does NOT detect Shopify in unrelated HTML', () => {
    const html = '<html><body><h1>Just a plain marketing page</h1></body></html>';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.ecommerce).not.toContain('Shopify');
  });

  // ------------------------- WooCommerce -------------------------
  it('detects WooCommerce from plugin path', () => {
    const html = '<link href="/wp-content/plugins/woocommerce/assets/css/woo.css">';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.ecommerce).toContain('WooCommerce');
  });

  it('detects WooCommerce from woocommerce class', () => {
    const html = '<body class="woocommerce woocommerce-page"><div></div></body>';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.ecommerce).toContain('WooCommerce');
  });

  // ------------------------- HubSpot -------------------------
  it('detects HubSpot from hs-scripts.com', () => {
    const html = '<script src="//js.hs-scripts.com/123456.js"></script>';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.martech).toContain('HubSpot');
  });

  it('detects HubSpot from _hsq variable', () => {
    const html = '<script>var _hsq = window._hsq = window._hsq || [];</script>';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.martech).toContain('HubSpot');
  });

  // ------------------------- GA4 -------------------------
  it('detects GA4 from gtag config G-', () => {
    const html = "<script>gtag('config', 'G-ABC123XYZ');</script>";
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.martech).toContain('Google Analytics 4');
  });

  it('does NOT detect Universal Analytics (UA-) as GA4', () => {
    const html = "<script>gtag('config', 'UA-12345678-1');</script>";
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.martech).not.toContain('Google Analytics 4');
  });

  // ------------------------- Cloudflare (headers) -------------------------
  it('detects Cloudflare from CF-RAY header', () => {
    const stack = parseTechStack('', { 'cf-ray': '88a1b2c3d4e5f6-AMS' });
    expect(stack.infrastructure).toContain('Cloudflare');
  });

  it('detects Cloudflare from Server: cloudflare header', () => {
    const stack = parseTechStack('', { server: 'cloudflare' });
    expect(stack.infrastructure).toContain('Cloudflare');
  });

  // ------------------------- AWS (headers) -------------------------
  it('detects AWS from X-Amz header', () => {
    const stack = parseTechStack('', { 'x-amz-id-2': 'abc123', 'x-amz-request-id': 'def456' });
    expect(stack.infrastructure).toContain('AWS');
  });

  // ------------------------- Hotjar -------------------------
  it('detects Hotjar from static.hotjar.com', () => {
    const html = '<script src="https://static.hotjar.com/c/hotjar-123.js"></script>';
    const stack = parseTechStack(html, NO_HEADERS);
    expect(stack.martech).toContain('Hotjar');
  });

  // ------------------------- GDPR: no PII -------------------------
  it('does not capture email addresses', () => {
    const html =
      '<a href="mailto:jane.doe@example.com">Contact jane.doe@example.com</a>' +
      '<script src="https://cdn.shopify.com/app.js"></script>';
    const stack = parseTechStack(html, NO_HEADERS);
    const serialized = JSON.stringify(stack);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('jane.doe@example.com');
  });

  it('does not capture personal names from meta tags', () => {
    const html =
      '<meta name="author" content="Johanna Müller">' +
      '<meta property="article:author" content="Pierre Dupont">' +
      '<script src="https://js.hs-scripts.com/1.js"></script>';
    const stack = parseTechStack(html, NO_HEADERS);
    const serialized = JSON.stringify(stack);
    expect(serialized).not.toContain('Johanna Müller');
    expect(serialized).not.toContain('Pierre Dupont');
    // Only the technology name is recorded.
    expect(stack.martech).toContain('HubSpot');
  });

  // ------------------------- Multiple tech -------------------------
  it('detects Shopify + HubSpot + Cloudflare simultaneously', () => {
    const html =
      '<script src="https://cdn.shopify.com/app.js"></script>' +
      '<script src="https://js.hs-scripts.com/1.js"></script>';
    const stack = parseTechStack(html, { 'cf-ray': '88a-AMS' });
    expect(stack.ecommerce).toContain('Shopify');
    expect(stack.martech).toContain('HubSpot');
    expect(stack.infrastructure).toContain('Cloudflare');
  });
});

describe('techStackToSignature', () => {
  it('returns sorted flat array', () => {
    const stack = emptyTechStack();
    stack.ecommerce = ['Shopify'];
    stack.martech = ['HubSpot', 'Hotjar'];
    stack.infrastructure = ['Cloudflare'];
    const sig = techStackToSignature(stack);
    expect(sig).toEqual(['Cloudflare', 'Hotjar', 'HubSpot', 'Shopify']);
    // Confirm it is genuinely sorted.
    expect(sig).toEqual([...sig].sort((a, b) => a.localeCompare(b)));
  });

  it('returns empty array for empty stack', () => {
    expect(techStackToSignature(emptyTechStack())).toEqual([]);
  });

  it('flattens a realistic multi-category stack via the parser', () => {
    const html =
      '<script src="https://cdn.shopify.com/app.js"></script>' +
      '<script src="https://static.hotjar.com/h.js"></script>';
    const sig = flat(parseTechStack(html, { 'cf-ray': 'x' }));
    expect(sig).toContain('Shopify');
    expect(sig).toContain('Hotjar');
    expect(sig).toContain('Cloudflare');
  });
});

// Small shared HTTP/query helpers used across routes.

/**
 * Parse an optional query-string integer and clamp it into [min, max],
 * falling back to `def` when absent or non-numeric. Used for `page`/`limit`
 * pagination params on every list endpoint.
 */
export function clampInt(
  value: string | undefined,
  def: number,
  min: number,
  max: number,
): number {
  const n = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

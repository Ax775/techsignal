// Shared date helpers. The API returns timestamps either as ISO strings or as
// SQLite-style "YYYY-MM-DD HH:MM:SS" (UTC, no zone) — normalize both here.

function parse(raw: string): Date {
  return new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
}

/** "12m ago", "3h ago", "just now" — for display. */
export function timeAgo(raw: string): string {
  const d = parse(raw);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return raw;
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return absolute(raw);
}

/** Full, unambiguous timestamp — for `title` tooltips on hover. */
export function absolute(raw: string): string {
  const d = parse(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** True if the timestamp is younger than `minutes` (default 2). */
export function isFresh(raw: string, minutes = 2): boolean {
  const d = parse(raw);
  return Date.now() - d.getTime() < minutes * 60 * 1000;
}

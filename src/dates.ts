// Lightweight date helpers operating at day granularity.
// All dates in the app are handled as ISO `yyyy-mm-dd` strings and converted to
// local-midnight Date objects only for arithmetic, so DST / timezone offsets
// never shift a "day".

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse an ISO `yyyy-mm-dd` string into a local-midnight Date. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight, no time component
}

/** Format a Date as ISO `yyyy-mm-dd` (local). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True if the string is a valid ISO `yyyy-mm-dd` date. */
export function isValidISODate(iso: string | undefined | null): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISODate(iso);
  return !Number.isNaN(d.getTime()) && toISODate(d) === iso;
}

/**
 * Whole calendar days from `a` to `b` (b - a). Positive when b is after a.
 * Rounds to the nearest day to absorb any residual DST hour drift.
 */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Return a new Date `n` days after `date`. */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Return a new Date `n` months after `date` (calendar months). */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Today at local midnight. */
export function today(): Date {
  return parseISODate(toISODate(new Date()));
}

/** Human-friendly date label, e.g. "1 Apr 2026". */
export function formatHuman(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

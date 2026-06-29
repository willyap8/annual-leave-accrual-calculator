// Accrual engine — pure, time-based, no pay periods / steps / hours-worked.
//
// Model summary:
//   balance(D) = startingBalance
//              + dailyRate × accruingDays(referenceDate → D)
//              − plannedLeaveDeductedUpTo(D)
//
// See README "Accrual model" for the full description and worked examples.

import type { ForecastConfig, LeaveEntry } from './types';
import { addDays, daysBetween, parseISODate, toISODate } from './dates';

// ---------------------------------------------------------------------------
// The single tunable constant for the whole model.
// 365.25 absorbs leap years smoothly (one leap day every 4 years on average),
// so the daily rate is stable across year boundaries. Change here to adjust.
// ---------------------------------------------------------------------------
export const DAYS_PER_YEAR = 365.25;

/** Hours accrued per calendar day for a given annual entitlement. */
export function dailyRate(annualEntitlement: number): number {
  return annualEntitlement / DAYS_PER_YEAR;
}

interface DayInterval {
  start: number; // inclusive day index relative to reference date
  end: number; // inclusive day index relative to reference date
}

/**
 * Merge leave entries into a set of non-overlapping day-index intervals,
 * relative to the reference date. This is the union of all leave days, so
 * overlapping entries never double-count a day when excluding accrual.
 */
function leaveDayUnion(ref: Date, leave: LeaveEntry[]): DayInterval[] {
  const intervals: DayInterval[] = leave
    .map((e) => ({
      start: daysBetween(ref, parseISODate(e.start)),
      end: daysBetween(ref, parseISODate(e.end)),
    }))
    .filter((iv) => iv.end >= iv.start) // drop inverted ranges defensively
    .sort((a, b) => a.start - b.start);

  const merged: DayInterval[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end + 1) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/**
 * Count leave days (from the union) whose day-index falls in (0, dIndex],
 * i.e. days that have elapsed after the reference date up to and including D.
 * Used to exclude leave days from the accruing-day count when
 * `accrueWhileOnLeave` is false.
 */
function leaveDaysElapsed(union: DayInterval[], dIndex: number): number {
  let count = 0;
  for (const iv of union) {
    const lo = Math.max(iv.start, 1); // exclude the reference day itself (index 0)
    const hi = Math.min(iv.end, dIndex);
    if (hi >= lo) count += hi - lo + 1;
  }
  return count;
}

/**
 * Hours deducted by date D, deducting each entry's hours PROGRESSIVELY across
 * its inclusive day range: an entry of H hours over N days deducts H/N per day.
 * By the entry's end date the full H has been deducted; a mid-range date shows
 * a partial deduction. Overlapping entries simply stack.
 */
function deductedUpTo(ref: Date, leave: LeaveEntry[], dIndex: number): number {
  let total = 0;
  for (const e of leave) {
    const startIdx = daysBetween(ref, parseISODate(e.start));
    const endIdx = daysBetween(ref, parseISODate(e.end));
    const days = endIdx - startIdx + 1;
    if (days <= 0 || !Number.isFinite(e.hours)) continue;
    // Days of this entry that have elapsed by D (the start day counts as 1).
    const elapsed = Math.max(0, Math.min(days, dIndex - startIdx + 1));
    total += (e.hours * elapsed) / days;
  }
  return total;
}

/**
 * Project the leave balance (hours) at an arbitrary date.
 * For dates before the reference date the balance is just the starting balance
 * (the model only projects forward from the anchor).
 */
export function balanceAt(dateISO: string, config: ForecastConfig): number {
  const ref = parseISODate(config.referenceDate);
  const d = parseISODate(dateISO);
  const dIndex = daysBetween(ref, d);
  if (dIndex <= 0) return config.startingBalance;

  let accruingDays = dIndex;
  if (!config.accrueWhileOnLeave) {
    const union = leaveDayUnion(ref, config.leave);
    accruingDays -= leaveDaysElapsed(union, dIndex);
  }

  const accrued = dailyRate(config.annualEntitlement) * accruingDays;
  const deducted = deductedUpTo(ref, config.leave, dIndex);
  return config.startingBalance + accrued - deducted;
}

export interface SeriesPoint {
  /** ISO `yyyy-mm-dd` date. */
  date: string;
  /** Projected balance in hours. */
  balance: number;
}

/**
 * Sample the projected balance from the reference date to the forecast end.
 * Daily up to ~18 months, then a coarser step so the point count stays bounded.
 * Every leave boundary (start, end, the day before each) plus the reference and
 * end dates are always included so kinks in the line render crisply.
 */
export function sampleSeries(config: ForecastConfig): SeriesPoint[] {
  const ref = parseISODate(config.referenceDate);
  const end = parseISODate(config.forecastEnd);
  const totalDays = daysBetween(ref, end);
  if (totalDays <= 0) {
    return [{ date: config.referenceDate, balance: config.startingBalance }];
  }

  // ~520 points max keeps the chart smooth and responsive on mobile.
  const step = Math.max(1, Math.ceil(totalDays / 520));

  const indices = new Set<number>();
  for (let i = 0; i <= totalDays; i += step) indices.add(i);
  indices.add(totalDays);

  // Add leave boundaries (and the day before, to anchor the pre-leave slope).
  for (const e of config.leave) {
    for (const iso of [e.start, e.end]) {
      const idx = daysBetween(ref, parseISODate(iso));
      if (idx > 0 && idx <= totalDays) {
        indices.add(idx);
        if (idx - 1 > 0) indices.add(idx - 1);
        if (idx + 1 <= totalDays) indices.add(idx + 1);
      }
    }
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => {
      const iso = toISODate(addDays(ref, i));
      return { date: iso, balance: balanceAt(iso, config) };
    });
}

export interface NegativePoint {
  date: string;
  balance: number;
  /** The leave entry the balance is attributed to, if identifiable. */
  entry?: LeaveEntry;
}

/**
 * Find the first date in the forecast window where the projected balance drops
 * below zero, scanning the sampled series. Returns null if it never goes
 * negative. Attribution: the leave entry whose range contains the date, else
 * the most recent entry ending on/before it.
 */
export function findFirstNegative(config: ForecastConfig): NegativePoint | null {
  const series = sampleSeries(config);
  const hit = series.find((p) => p.balance < 0);
  if (!hit) return null;

  const ref = parseISODate(config.referenceDate);
  const hitIdx = daysBetween(ref, parseISODate(hit.date));

  // Prefer the entry whose range contains the date; otherwise the entry that
  // ended most recently before it (its deduction pushed the balance negative).
  let containing: LeaveEntry | undefined;
  let mostRecent: LeaveEntry | undefined;
  let mostRecentEndIdx = -Infinity;
  for (const e of config.leave) {
    const startIdx = daysBetween(ref, parseISODate(e.start));
    const endIdx = daysBetween(ref, parseISODate(e.end));
    if (startIdx <= hitIdx && hitIdx <= endIdx) {
      containing = e;
      break;
    }
    if (endIdx <= hitIdx && endIdx > mostRecentEndIdx) {
      mostRecentEndIdx = endIdx;
      mostRecent = e;
    }
  }
  return { date: hit.date, balance: hit.balance, entry: containing ?? mostRecent };
}

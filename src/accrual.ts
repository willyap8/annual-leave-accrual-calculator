// Accrual engine — pure, time-based, no pay periods / steps / hours-worked.
//
// Model summary:
//   balance(D) = startingBalance
//              + dailyRate × accruingDays(referenceDate → D)
//              − plannedLeaveDeductedUpTo(D)
//
// The balance is computed by a chronological, day-by-day simulation from the
// reference date forward. A closed form would be simpler, but UNPAID LEAVE makes
// the result order-dependent: a leave entry only spills into unpaid leave once
// the *running* balance has hit zero, so we must walk the days in order.
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

// Floating-point slack: balances within EPS of zero count as "exhausted".
const EPS = 1e-9;

/** Hours accrued per calendar day for a given annual entitlement. */
export function dailyRate(annualEntitlement: number): number {
  return annualEntitlement / DAYS_PER_YEAR;
}

// Pre-resolved per-day view of a leave entry, in day-indices from the ref date.
interface EntryIdx {
  startIdx: number;
  endIdx: number;
  perDay: number; // progressive deduction = hours / inclusive-days
  allowUnpaid: boolean;
}

function entryIndices(ref: Date, leave: LeaveEntry[]): EntryIdx[] {
  return leave
    .map((e) => {
      const startIdx = daysBetween(ref, parseISODate(e.start));
      const endIdx = daysBetween(ref, parseISODate(e.end));
      const days = endIdx - startIdx + 1;
      const perDay = days > 0 && Number.isFinite(e.hours) ? e.hours / days : 0;
      return { startIdx, endIdx, perDay, allowUnpaid: !!e.allowUnpaid };
    })
    .filter((x) => x.endIdx >= x.startIdx); // drop inverted ranges defensively
}

interface Simulation {
  /** Projected balance at each day index 0..n (0 = reference date). */
  balances: number[];
  /** True on a day that produced unpaid-leave hours. */
  unpaidDay: boolean[];
  /** Total planned-leave hours that fell beyond the balance (unpaid). */
  totalUnpaidHours: number;
  /** First day index where the balance goes below zero, or null. */
  firstNegativeIndex: number | null;
}

/**
 * Walk the days from the reference date to `untilIndex`, applying accrual and
 * leave deductions one day at a time.
 *
 * Per-day rules:
 *  - Accrual: a day accrues `dailyRate` UNLESS
 *      (a) it's a leave day and "accrue while on leave" is off, or
 *      (b) it's an unpaid-leave day — i.e. the balance is already exhausted and
 *          the day falls on a leave entry that allows unpaid leave.
 *    (b) implements "no annual leave is accrued during unpaid leave".
 *  - Deduction (progressive): each active entry deducts hours/inclusive-days.
 *      • Entries that do NOT allow unpaid leave deduct unconditionally and may
 *        drive the balance negative (this is the existing negative-balance path,
 *        surfaced as a non-blocking warning).
 *      • Entries that DO allow unpaid leave only deduct down to zero; the
 *        shortfall becomes unpaid-leave hours and the balance floors at zero.
 */
function simulate(config: ForecastConfig, untilIndex: number): Simulation {
  const ref = parseISODate(config.referenceDate);
  const rate = dailyRate(config.annualEntitlement);
  const entries = entryIndices(ref, config.leave);
  const n = Math.max(0, untilIndex);

  const balances = new Array<number>(n + 1);
  const unpaidDay = new Array<boolean>(n + 1).fill(false);
  let totalUnpaidHours = 0;
  let firstNegativeIndex: number | null = null;

  balances[0] = config.startingBalance;
  if (balances[0] < -EPS) firstNegativeIndex = 0;

  for (let i = 1; i <= n; i++) {
    const prev = balances[i - 1];

    // What leave (if any) is active on day i?
    let isLeaveDay = false;
    let unpaidEligibleDed = 0; // from entries that allow unpaid leave
    let mandatoryDed = 0; // from entries that do not
    for (const e of entries) {
      if (i >= e.startIdx && i <= e.endIdx) {
        isLeaveDay = true;
        if (e.allowUnpaid) unpaidEligibleDed += e.perDay;
        else mandatoryDed += e.perDay;
      }
    }

    const exhausted = prev <= EPS;
    const isUnpaidDay = unpaidEligibleDed > 0 && exhausted;

    // Accrual for the day.
    let acc = rate;
    if (isUnpaidDay) acc = 0; // (b) no accrual during unpaid leave
    else if (isLeaveDay && !config.accrueWhileOnLeave) acc = 0; // (a)

    let bal = prev + acc;

    // Mandatory deductions first (may go negative -> warning path).
    bal -= mandatoryDed;

    // Unpaid-eligible deductions floor at zero; the shortfall is unpaid.
    if (unpaidEligibleDed > 0) {
      const payable = Math.max(0, bal);
      const paid = Math.min(unpaidEligibleDed, payable);
      const unpaid = unpaidEligibleDed - paid;
      bal -= paid;
      if (unpaid > EPS) {
        totalUnpaidHours += unpaid;
        unpaidDay[i] = true;
      }
    }

    balances[i] = bal;
    if (bal < -EPS && firstNegativeIndex === null) firstNegativeIndex = i;
  }

  return { balances, unpaidDay, totalUnpaidHours, firstNegativeIndex };
}

/**
 * Project the leave balance (hours) at an arbitrary date.
 * For dates before the reference date the balance is just the starting balance
 * (the model only projects forward from the anchor).
 */
export function balanceAt(dateISO: string, config: ForecastConfig): number {
  const ref = parseISODate(config.referenceDate);
  const dIndex = daysBetween(ref, parseISODate(dateISO));
  if (dIndex <= 0) return config.startingBalance;
  return simulate(config, dIndex).balances[dIndex];
}

export interface SeriesPoint {
  /** ISO `yyyy-mm-dd` date. */
  date: string;
  /** Projected balance in hours. */
  balance: number;
  /** True if this day involved unpaid leave. */
  unpaid: boolean;
}

export interface NegativePoint {
  date: string;
  balance: number;
  /** The leave entry the balance is attributed to, if identifiable. */
  entry?: LeaveEntry;
}

export interface DateInterval {
  start: string;
  end: string;
}

export interface ForecastResult {
  series: SeriesPoint[];
  firstNegative: NegativePoint | null;
  totalUnpaidHours: number;
  /** Contiguous date ranges that fell into unpaid leave (for chart shading). */
  unpaidIntervals: DateInterval[];
}

/**
 * Build everything the UI needs from a single simulation over the forecast
 * window: the sampled line, the first negative point, total unpaid hours, and
 * the unpaid-leave date ranges.
 */
export function buildForecast(config: ForecastConfig): ForecastResult {
  const ref = parseISODate(config.referenceDate);
  const end = parseISODate(config.forecastEnd);
  const totalDays = daysBetween(ref, end);

  if (totalDays <= 0) {
    return {
      series: [{ date: config.referenceDate, balance: config.startingBalance, unpaid: false }],
      firstNegative: null,
      totalUnpaidHours: 0,
      unpaidIntervals: [],
    };
  }

  const sim = simulate(config, totalDays);

  // --- Sampled series ---------------------------------------------------
  // Daily up to ~520 points, then a coarser step so the count stays bounded.
  // Always include leave boundaries and unpaid-leave transitions so kinks and
  // the point where the balance hits zero render crisply.
  const step = Math.max(1, Math.ceil(totalDays / 520));
  const indices = new Set<number>();
  for (let i = 0; i <= totalDays; i += step) indices.add(i);
  indices.add(totalDays);

  const addBreakpoint = (idx: number) => {
    if (idx > 0 && idx <= totalDays) indices.add(idx);
    if (idx - 1 > 0 && idx - 1 <= totalDays) indices.add(idx - 1);
    if (idx + 1 > 0 && idx + 1 <= totalDays) indices.add(idx + 1);
  };
  for (const e of config.leave) {
    addBreakpoint(daysBetween(ref, parseISODate(e.start)));
    addBreakpoint(daysBetween(ref, parseISODate(e.end)));
  }
  // Unpaid-leave transitions (so the flat-at-zero stretch is captured).
  for (let i = 1; i <= totalDays; i++) {
    if (sim.unpaidDay[i] !== sim.unpaidDay[i - 1]) addBreakpoint(i);
  }

  const series: SeriesPoint[] = [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({
      date: toISODate(addDays(ref, i)),
      balance: sim.balances[i],
      unpaid: sim.unpaidDay[i],
    }));

  // --- First negative point --------------------------------------------
  let firstNegative: NegativePoint | null = null;
  if (sim.firstNegativeIndex !== null) {
    const idx = sim.firstNegativeIndex;
    const date = toISODate(addDays(ref, idx));
    firstNegative = { date, balance: sim.balances[idx], entry: attributeEntry(config, idx) };
  }

  // --- Unpaid-leave intervals ------------------------------------------
  const unpaidIntervals: DateInterval[] = [];
  let runStart: number | null = null;
  for (let i = 0; i <= totalDays; i++) {
    if (sim.unpaidDay[i] && runStart === null) {
      runStart = i;
    } else if (!sim.unpaidDay[i] && runStart !== null) {
      unpaidIntervals.push({
        start: toISODate(addDays(ref, runStart)),
        end: toISODate(addDays(ref, i - 1)),
      });
      runStart = null;
    }
  }
  if (runStart !== null) {
    unpaidIntervals.push({
      start: toISODate(addDays(ref, runStart)),
      end: toISODate(addDays(ref, totalDays)),
    });
  }

  return { series, firstNegative, totalUnpaidHours: sim.totalUnpaidHours, unpaidIntervals };
}

/** Attribute a day index to the leave entry responsible (contains it, else the most recent). */
function attributeEntry(config: ForecastConfig, dayIndex: number): LeaveEntry | undefined {
  const ref = parseISODate(config.referenceDate);
  let containing: LeaveEntry | undefined;
  let mostRecent: LeaveEntry | undefined;
  let mostRecentEndIdx = -Infinity;
  for (const e of config.leave) {
    const startIdx = daysBetween(ref, parseISODate(e.start));
    const endIdx = daysBetween(ref, parseISODate(e.end));
    if (startIdx <= dayIndex && dayIndex <= endIdx) return e;
    if (endIdx <= dayIndex && endIdx > mostRecentEndIdx) {
      mostRecentEndIdx = endIdx;
      mostRecent = e;
    }
  }
  return containing ?? mostRecent;
}

// --- Backwards-compatible thin wrappers (used by tests) -------------------

export function sampleSeries(config: ForecastConfig): SeriesPoint[] {
  return buildForecast(config).series;
}

export function findFirstNegative(config: ForecastConfig): NegativePoint | null {
  return buildForecast(config).firstNegative;
}

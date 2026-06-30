import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_YEAR,
  WEEKDAYS_PER_YEAR,
  balanceAt,
  buildForecast,
  findFirstNegative,
  sampleSeries,
  weekdayRate,
} from './accrual';
import type { ForecastConfig, LeaveEntry } from './types';
import { daysBetween, parseISODate } from './dates';

const close = (a: number, b: number, eps = 1e-6) =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

function makeConfig(overrides: Partial<ForecastConfig> = {}): ForecastConfig {
  return {
    startingBalance: 80,
    referenceDate: '2026-01-01',
    annualEntitlement: 152,
    accrueWhileOnLeave: true,
    leave: [],
    forecastEnd: '2026-12-31',
    ...overrides,
  };
}

const leave = (
  start: string,
  end: string,
  hours: number,
  opts: { label?: string; allowUnpaid?: boolean } = {},
): LeaveEntry => ({
  id: `${start}-${end}`,
  start,
  end,
  hours,
  label: opts.label,
  allowUnpaid: opts.allowUnpaid,
});

describe('weekdayRate', () => {
  it('divides annual entitlement by weekdays-per-year (365.25 × 5/7)', () => {
    expect(DAYS_PER_YEAR).toBe(365.25);
    close(WEEKDAYS_PER_YEAR, (365.25 * 5) / 7);
    close(weekdayRate(152), 152 / WEEKDAYS_PER_YEAR);
  });
});

describe('worked examples (weekday accrual; ref 2026-01-01 is a Thursday)', () => {
  it('Example 1: pure accrual, no leave', () => {
    // Accrues only on the weekdays between 1 Jan and 1 Apr 2026.
    const cfg = makeConfig();
    close(balanceAt('2026-04-01', cfg), 117.2873374401097);
  });

  it('Example 2: one leave entry, accrual continues (checked)', () => {
    const cfg = makeConfig({ leave: [leave('2026-02-01', '2026-02-05', 38)] });
    // Full deduction applied by end of leave: 117.287 - 38 = 79.287
    close(balanceAt('2026-04-01', cfg), 79.2873374401097);
    // Mid-leave: 1 Feb is a Sunday (deducts 0); deduction spread over the 4
    // weekdays (Mon–Thu), so by Tue 3 Feb two of four weekdays have deducted.
    close(balanceAt('2026-02-03', cfg), 74.40013689253942);
  });

  it('Example 3: same leave, accrual paused (unchecked)', () => {
    const cfg = makeConfig({
      accrueWhileOnLeave: false,
      leave: [leave('2026-02-01', '2026-02-05', 38)],
    });
    close(balanceAt('2026-04-01', cfg), 76.95687885010284);
  });
});

describe('progressive deduction', () => {
  it('deducts nothing before the leave starts', () => {
    const cfg = makeConfig({ leave: [leave('2026-03-01', '2026-03-10', 76)] });
    close(balanceAt('2026-02-15', cfg), balanceAt('2026-02-15', makeConfig()));
  });

  it('deducts the full amount by the end date', () => {
    const cfg = makeConfig({ leave: [leave('2026-03-01', '2026-03-10', 76)] });
    const withLeave = balanceAt('2026-03-10', cfg);
    const without = balanceAt('2026-03-10', makeConfig());
    close(without - withLeave, 76);
  });
});

describe('edge cases', () => {
  it('returns starting balance at and before the reference date', () => {
    const cfg = makeConfig();
    close(balanceAt('2026-01-01', cfg), 80);
    close(balanceAt('2025-06-01', cfg), 80); // before reference -> no projection back
  });

  it('renders a pure accrual line when there is no leave', () => {
    const series = sampleSeries(makeConfig());
    expect(series.length).toBeGreaterThan(2);
    close(series[0].balance, 80);
    // Monotonically increasing with no leave.
    for (let i = 1; i < series.length; i++) {
      expect(series[i].balance).toBeGreaterThanOrEqual(series[i - 1].balance);
    }
  });

  it('handles overlapping leave entries: deductions stack', () => {
    const cfg = makeConfig({
      leave: [leave('2026-02-01', '2026-02-10', 40), leave('2026-02-05', '2026-02-15', 40)],
    });
    const without = balanceAt('2026-03-01', makeConfig());
    const withLeave = balanceAt('2026-03-01', cfg);
    close(without - withLeave, 80); // both fully deducted by 1 Mar
  });

  it('overlapping leave days are not double-excluded from accrual (union)', () => {
    // Two identical 0-hour entries (no deduction) with accrual paused must
    // exclude the SAME accrual as a single entry — the union is counted once.
    const one = makeConfig({
      accrueWhileOnLeave: false,
      leave: [leave('2026-02-01', '2026-02-10', 0)],
    });
    const two = makeConfig({
      accrueWhileOnLeave: false,
      leave: [leave('2026-02-01', '2026-02-10', 0), leave('2026-02-01', '2026-02-10', 0)],
    });
    close(balanceAt('2026-04-01', one), balanceAt('2026-04-01', two));
  });

  it('flags the first negative balance and attributes an entry', () => {
    const cfg = makeConfig({
      startingBalance: 10,
      leave: [leave('2026-02-01', '2026-02-05', 100, { label: 'Big trip' })],
    });
    const neg = findFirstNegative(cfg);
    expect(neg).not.toBeNull();
    expect(neg!.balance).toBeLessThan(0);
    expect(neg!.entry?.label).toBe('Big trip');
  });

  it('returns null when the balance never goes negative', () => {
    expect(findFirstNegative(makeConfig())).toBeNull();
  });

  describe('unpaid leave (allowUnpaid)', () => {
    // start 10 h, 100 h of leave over 1–10 Feb -> balance runs out mid-leave.
    const unpaidCfg = (allowUnpaid: boolean) =>
      makeConfig({
        startingBalance: 10,
        leave: [leave('2026-02-01', '2026-02-10', 100, { allowUnpaid, label: 'Trip' })],
      });

    it('without allowUnpaid the balance goes negative (warning path)', () => {
      const f = buildForecast(unpaidCfg(false));
      expect(f.firstNegative).not.toBeNull();
      expect(f.totalUnpaidHours).toBe(0);
    });

    it('with allowUnpaid the balance floors at zero and never goes negative', () => {
      const f = buildForecast(unpaidCfg(true));
      expect(f.firstNegative).toBeNull();
      for (const p of f.series) expect(p.balance).toBeGreaterThanOrEqual(-1e-9);
    });

    it('reports the overdrawn hours as unpaid leave', () => {
      const f = buildForecast(unpaidCfg(true));
      // 100 h leave covered only by the small balance + weekday accrual.
      close(f.totalUnpaidHours, 76.59986310746066, 1e-4);
      // The unpaid stretch is split by the 7–8 Feb weekend (weekends aren't
      // deducting days, so they're not flagged unpaid) -> two intervals.
      expect(f.unpaidIntervals).toHaveLength(2);
    });

    it('does not accrue during unpaid leave even when accrual-while-on-leave is on', () => {
      const cfg = unpaidCfg(true);
      expect(cfg.accrueWhileOnLeave).toBe(true);
      // 8 Feb is deep inside the unpaid stretch: balance pinned at exactly 0.
      close(balanceAt('2026-02-08', cfg), 0);
      // After leave ends, accrual resumes from zero (weekdays only).
      close(balanceAt('2026-02-15', cfg), 1.7478439425051333, 1e-6);
    });
  });

  it('forecast end before reference date yields a single point', () => {
    const cfg = makeConfig({ forecastEnd: '2025-01-01' });
    const series = sampleSeries(cfg);
    expect(series).toHaveLength(1);
    close(series[0].balance, 80);
  });
});

describe('weekends', () => {
  it('preserves the annual total: ~entitlement accrued over a full year', () => {
    const cfg = makeConfig({ startingBalance: 0, forecastEnd: '2027-01-01' });
    // 152 h/yr spread across weekdays still totals ~152 h after a year
    // (small variance because a calendar year has 260–262 weekdays).
    close(balanceAt('2027-01-01', cfg), 152, 1);
  });

  it('does not accrue on weekends (balance flat Fri → Mon)', () => {
    const cfg = makeConfig({ startingBalance: 0 });
    const fri = balanceAt('2026-01-02', cfg); // Friday
    const sat = balanceAt('2026-01-03', cfg);
    const sun = balanceAt('2026-01-04', cfg);
    const mon = balanceAt('2026-01-05', cfg); // Monday
    close(sat, fri); // no change across Sat
    close(sun, fri); // no change across Sun
    expect(mon).toBeGreaterThan(fri); // accrues again on Monday
    close(mon - fri, weekdayRate(152)); // exactly one weekday's accrual
  });

  it('samples a long window densely enough to keep the weekday sawtooth clean', () => {
    // A ~2-year window must still render every day's accrual faithfully:
    // consecutive series points stay within ~1 week, so the chart never aliases
    // the weekday/weekend sawtooth into misleading slopes (the old 520-point
    // cap sampled every other day and made weekends look like they fell on the
    // wrong days).
    const cfg = makeConfig({ referenceDate: '2025-01-01', forecastEnd: '2026-12-31' });
    const series = sampleSeries(cfg);
    let maxGapDays = 0;
    for (let i = 1; i < series.length; i++) {
      const gap = daysBetween(parseISODate(series[i - 1].date), parseISODate(series[i].date));
      maxGapDays = Math.max(maxGapDays, gap);
    }
    expect(maxGapDays).toBeLessThanOrEqual(7);
  });

  it('deducts leave on weekdays only across a weekend span', () => {
    // 16 Mar 2026 is a Monday; 27 Mar is a Friday -> 10 weekdays, 2 weekend days.
    const cfg = makeConfig({ leave: [leave('2026-03-16', '2026-03-27', 76)] });
    const base = makeConfig();
    // Balance flat across the Sat/Sun (21–22 Mar): no accrual, no deduction.
    close(balanceAt('2026-03-22', cfg), balanceAt('2026-03-21', cfg));
    // Full hours deducted by the end date.
    close(balanceAt('2026-03-27', base) - balanceAt('2026-03-27', cfg), 76);
  });
});

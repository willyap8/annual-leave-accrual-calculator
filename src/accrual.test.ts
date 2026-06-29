import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_YEAR,
  balanceAt,
  dailyRate,
  findFirstNegative,
  sampleSeries,
} from './accrual';
import type { ForecastConfig, LeaveEntry } from './types';

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

const leave = (start: string, end: string, hours: number, label?: string): LeaveEntry => ({
  id: `${start}-${end}`,
  start,
  end,
  hours,
  label,
});

describe('dailyRate', () => {
  it('divides annual entitlement by 365.25', () => {
    expect(DAYS_PER_YEAR).toBe(365.25);
    close(dailyRate(152), 152 / 365.25);
  });
});

describe('worked examples', () => {
  it('Example 1: pure accrual, no leave', () => {
    // 80 + (152/365.25)*90 ≈ 117.45
    const cfg = makeConfig();
    close(balanceAt('2026-04-01', cfg), 117.45379876796716);
  });

  it('Example 2: one leave entry, accrual continues (checked)', () => {
    const cfg = makeConfig({ leave: [leave('2026-02-01', '2026-02-05', 38)] });
    // Full deduction applied by end of leave: 117.45 - 38 = 79.45
    close(balanceAt('2026-04-01', cfg), 79.45379876796716);
    // Mid-leave (3 of 5 days) deducts 38*3/5 = 22.8; 2026-02-03 is 33 days in.
    close(balanceAt('2026-02-03', cfg), 70.93305954825462);
  });

  it('Example 3: same leave, accrual paused (unchecked)', () => {
    const cfg = makeConfig({
      accrueWhileOnLeave: false,
      leave: [leave('2026-02-01', '2026-02-05', 38)],
    });
    // 5 leave days excluded -> accrue 85 days: 80 + r*85 - 38 ≈ 77.37
    close(balanceAt('2026-04-01', cfg), 77.37303216974675);
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
    // Two entries covering the SAME 10 days -> only 10 accrual days excluded.
    const cfg = makeConfig({
      accrueWhileOnLeave: false,
      leave: [leave('2026-02-01', '2026-02-10', 10), leave('2026-02-01', '2026-02-10', 10)],
    });
    const ref = makeConfig({ accrueWhileOnLeave: false });
    // Accrual difference vs no-leave should reflect exactly 10 excluded days.
    const accrualOnly = balanceAt('2026-04-01', ref); // 80 + r*90
    const withExclusion = balanceAt('2026-04-01', cfg) + 20; // add back the 20h deducted
    close(accrualOnly - withExclusion, dailyRate(152) * 10);
  });

  it('flags the first negative balance and attributes an entry', () => {
    const cfg = makeConfig({
      startingBalance: 10,
      leave: [leave('2026-02-01', '2026-02-05', 100, 'Big trip')],
    });
    const neg = findFirstNegative(cfg);
    expect(neg).not.toBeNull();
    expect(neg!.balance).toBeLessThan(0);
    expect(neg!.entry?.label).toBe('Big trip');
  });

  it('returns null when the balance never goes negative', () => {
    expect(findFirstNegative(makeConfig())).toBeNull();
  });

  it('forecast end before reference date yields a single point', () => {
    const cfg = makeConfig({ forecastEnd: '2025-01-01' });
    const series = sampleSeries(cfg);
    expect(series).toHaveLength(1);
    close(series[0].balance, 80);
  });
});

import { describe, expect, it } from 'vitest';
import { WEEKDAYS_PER_YEAR } from './accrual';
import { ENTITLEMENT_UNITS, fromAnnual, toAnnual } from './entitlement';

const close = (a: number, b: number, eps = 1e-9) =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

describe('entitlement unit conversion', () => {
  it('year is the identity unit', () => {
    close(toAnnual(160, 'year'), 160);
    close(fromAnnual(160, 'year'), 160);
  });

  it('working day maps directly onto the weekday-rate basis', () => {
    close(toAnnual(1, 'workingDay'), WEEKDAYS_PER_YEAR);
    close(fromAnnual(WEEKDAYS_PER_YEAR, 'workingDay'), 1);
  });

  it('fortnight = 10 working days (and equals calendar fortnights)', () => {
    close(toAnnual(1, 'fortnight'), WEEKDAYS_PER_YEAR / 10);
    close(WEEKDAYS_PER_YEAR / 10, 365.25 / 14); // 26.0893 fortnights / year
  });

  it('week = 5 working days (and equals calendar weeks)', () => {
    close(toAnnual(1, 'week'), WEEKDAYS_PER_YEAR / 5);
    close(WEEKDAYS_PER_YEAR / 5, 365.25 / 7); // 52.1786 weeks / year
  });

  it('round-trips any value through every unit', () => {
    for (const u of ENTITLEMENT_UNITS) {
      close(fromAnnual(toAnnual(7.5, u.value), u.value), 7.5);
    }
  });

  it('preserves the annual total when re-expressed in another unit', () => {
    // 200 h/yr entered as a per-working-day rate still totals 200 h/yr.
    const perDay = fromAnnual(200, 'workingDay');
    close(toAnnual(perDay, 'workingDay'), 200);
    // …and a 76 h/fortnight rate is the same total however it is read back.
    close(fromAnnual(toAnnual(76, 'fortnight'), 'fortnight'), 76);
  });
});

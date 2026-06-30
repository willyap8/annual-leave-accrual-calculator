// Entitlement-unit conversions for the setup form.
//
// The accrual engine only ever reads ONE value — `annualEntitlement` (hours per
// year). But users may prefer to enter their accrual rate per fortnight, per
// week, or per working day. All non-year units are defined in WORKING DAYS
// (Mon–Fri), matching the weekday-only accrual model, so the annual total is
// identical however it is entered:
//   1 fortnight = 10 working days, 1 week = 5 working days, 1 working day = 1.
// These also coincide exactly with the calendar: a year has WEEKDAYS_PER_YEAR
// working days ≈ 260.89, i.e. ≈ 26.09 fortnights (365.25/14) and ≈ 52.18 weeks
// (365.25/7).

import { WEEKDAYS_PER_YEAR } from './accrual';
import type { EntitlementUnit } from './types';

interface UnitDef {
  value: EntitlementUnit;
  /** Dropdown option text. */
  label: string;
  /** Hours per year for 1 of this unit (annual = enteredValue × perYear). */
  perYear: number;
}

export const ENTITLEMENT_UNITS: UnitDef[] = [
  { value: 'year', label: 'hours / year', perYear: 1 },
  { value: 'fortnight', label: 'hours / fortnight', perYear: WEEKDAYS_PER_YEAR / 10 },
  { value: 'week', label: 'hours / week', perYear: WEEKDAYS_PER_YEAR / 5 },
  { value: 'workingDay', label: 'hours / working day', perYear: WEEKDAYS_PER_YEAR },
];

const FACTORS = Object.fromEntries(
  ENTITLEMENT_UNITS.map((u) => [u.value, u.perYear]),
) as Record<EntitlementUnit, number>;

/** Convert a value entered in `unit` to the canonical annual hours. */
export function toAnnual(value: number, unit: EntitlementUnit): number {
  return value * FACTORS[unit];
}

/** Express the canonical annual hours in `unit`. */
export function fromAnnual(annual: number, unit: EntitlementUnit): number {
  return annual / FACTORS[unit];
}

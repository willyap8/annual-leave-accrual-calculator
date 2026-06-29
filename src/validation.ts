// Input validation. Produces friendly inline messages without ever blocking the
// calculation — the engine clamps/ignores bad values, these messages just guide
// the user.

import type { ForecastConfig, LeaveEntry } from './types';
import { isValidISODate, parseISODate } from './dates';

export interface ConfigErrors {
  startingBalance?: string;
  referenceDate?: string;
  annualEntitlement?: string;
  forecastEnd?: string;
}

export function validateConfig(config: ForecastConfig): ConfigErrors {
  const errors: ConfigErrors = {};

  if (!Number.isFinite(config.startingBalance)) {
    errors.startingBalance = 'Enter a number of hours.';
  }
  if (!isValidISODate(config.referenceDate)) {
    errors.referenceDate = 'Pick a valid reference date.';
  }
  if (!Number.isFinite(config.annualEntitlement) || config.annualEntitlement <= 0) {
    errors.annualEntitlement = 'Enter the annual hours (greater than 0).';
  }
  if (!isValidISODate(config.forecastEnd)) {
    errors.forecastEnd = 'Pick a valid end date.';
  } else if (
    isValidISODate(config.referenceDate) &&
    parseISODate(config.forecastEnd) < parseISODate(config.referenceDate)
  ) {
    errors.forecastEnd = 'End date must be on or after the reference date.';
  }

  return errors;
}

export interface LeaveErrors {
  start?: string;
  end?: string;
  hours?: string;
}

export function validateLeave(entry: LeaveEntry): LeaveErrors {
  const errors: LeaveErrors = {};
  if (!isValidISODate(entry.start)) errors.start = 'Invalid start date.';
  if (!isValidISODate(entry.end)) errors.end = 'Invalid end date.';
  if (
    isValidISODate(entry.start) &&
    isValidISODate(entry.end) &&
    parseISODate(entry.end) < parseISODate(entry.start)
  ) {
    errors.end = 'End must be on or after start.';
  }
  if (!Number.isFinite(entry.hours) || entry.hours < 0) {
    errors.hours = 'Enter hours (0 or more).';
  }
  return errors;
}

export function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

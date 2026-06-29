// Core data model for the annual leave accrual forecaster.
// Kept deliberately simple/extensible so additional leave types could be added
// later (e.g. by adding a `type` field to LeaveEntry) without reworking the engine.

export interface LeaveEntry {
  /** Stable id for list rendering / editing / deletion. */
  id: string;
  /** Inclusive start date, ISO `yyyy-mm-dd` (date-only, no time). */
  start: string;
  /** Inclusive end date, ISO `yyyy-mm-dd` (date-only, no time). */
  end: string;
  /** Hours deducted for this leave entry (entered directly by the user). */
  hours: number;
  /** Optional free-text label / note. */
  label?: string;
  /**
   * If true, hours taken beyond the available balance become unpaid leave:
   * the balance floors at zero (instead of going negative) and no accrual
   * happens on the unpaid days. Defaults to false (overdraw shows the
   * negative-balance warning instead).
   */
  allowUnpaid?: boolean;
}

export interface ForecastConfig {
  /** Annual leave hours accrued as at the reference date. */
  startingBalance: number;
  /** Anchor date for all forward calculations, ISO `yyyy-mm-dd`. */
  referenceDate: string;
  /** Total annual leave hours accrued per full year — drives the accrual rate. */
  annualEntitlement: number;
  /**
   * When true (default), leave accrues every calendar day regardless of whether
   * the user is on leave. When false, days on planned leave do not accrue.
   */
  accrueWhileOnLeave: boolean;
  /** Planned leave entries. */
  leave: LeaveEntry[];
  /** End date of the forecast window, ISO `yyyy-mm-dd`. */
  forecastEnd: string;
}

/** Persisted shape in localStorage (wraps config with a schema version). */
export interface PersistedState {
  version: number;
  config: ForecastConfig;
}

export type ThemeMode = 'light' | 'dark';

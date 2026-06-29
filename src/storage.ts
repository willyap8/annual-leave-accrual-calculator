// localStorage persistence + JSON export/import.
// Data is per-browser / per-device (no cloud sync). The export/import helpers
// let the user manually move data between devices.

import type { ForecastConfig, PersistedState, ThemeMode } from './types';
import { addMonths, toISODate, today } from './dates';

const STORAGE_KEY = 'alac.state.v1';
const THEME_KEY = 'alac.theme';
const SCHEMA_VERSION = 1;

/** A sensible starting configuration for a first-time user. */
export function defaultConfig(): ForecastConfig {
  const ref = today();
  return {
    startingBalance: 0,
    referenceDate: toISODate(ref),
    annualEntitlement: 160,
    accrueWhileOnLeave: true,
    leave: [],
    forecastEnd: toISODate(addMonths(ref, 12)),
  };
}

/** Load persisted config, falling back to defaults on missing/corrupt data. */
export function loadConfig(): ForecastConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object' || !parsed.config) {
      return defaultConfig();
    }
    // Merge over defaults so any field added in a later version is populated.
    return { ...defaultConfig(), ...parsed.config };
  } catch {
    return defaultConfig();
  }
}

/** Persist the current config. */
export function saveConfig(config: ForecastConfig): void {
  const state: PersistedState = { version: SCHEMA_VERSION, config };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode / quota) — fail silently.
  }
}

/** Remove all persisted app data. */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Serialize the current config to a pretty-printed JSON string for download. */
export function exportJson(config: ForecastConfig): string {
  const state: PersistedState = { version: SCHEMA_VERSION, config };
  return JSON.stringify(state, null, 2);
}

/**
 * Parse a JSON string previously produced by exportJson back into a config.
 * Throws a friendly Error if the payload is not a recognizable export.
 */
export function importJson(text: string): ForecastConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const candidate = parsed as Partial<PersistedState>;
  if (!candidate || typeof candidate !== 'object' || !candidate.config) {
    throw new Error('That file does not look like an exported forecast.');
  }
  return { ...defaultConfig(), ...candidate.config };
}

// --- Theme persistence -----------------------------------------------------

/** Read the saved theme, or fall back to the OS preference on first load. */
export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function saveTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

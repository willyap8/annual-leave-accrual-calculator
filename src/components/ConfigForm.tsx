import type { EntitlementUnit, ForecastConfig } from '../types';
import { validateConfig } from '../validation';
import { ENTITLEMENT_UNITS, fromAnnual, toAnnual } from '../entitlement';

interface Props {
  config: ForecastConfig;
  onChange: (patch: Partial<ForecastConfig>) => void;
}

/** Number input that reports NaN for empty/invalid so validation can flag it. */
function numberValue(raw: string): number {
  if (raw.trim() === '') return NaN;
  return Number(raw);
}

/** Round a derived per-unit value for display without long FP tails. */
function displayValue(annual: number, unit: EntitlementUnit): number | '' {
  if (!Number.isFinite(annual)) return '';
  return Number(fromAnnual(annual, unit).toFixed(4));
}

export default function ConfigForm({ config, onChange }: Props) {
  const errors = validateConfig(config);
  const unit = config.entitlementUnit ?? 'year';

  return (
    <section className="card" aria-labelledby="config-heading">
      <h2 id="config-heading">Your accrual setup</h2>

      <div className="field-grid">
        <div className="field">
          <label htmlFor="startingBalance">Starting balance (hours)</label>
          <input
            id="startingBalance"
            type="number"
            inputMode="decimal"
            step="any"
            value={Number.isFinite(config.startingBalance) ? config.startingBalance : ''}
            onChange={(e) => onChange({ startingBalance: numberValue(e.target.value) })}
            aria-invalid={!!errors.startingBalance}
          />
          {errors.startingBalance && <p className="field-error">{errors.startingBalance}</p>}
        </div>

        <div className="field">
          <label htmlFor="referenceDate">Reference date</label>
          <input
            id="referenceDate"
            type="date"
            value={config.referenceDate}
            onChange={(e) => onChange({ referenceDate: e.target.value })}
            aria-invalid={!!errors.referenceDate}
          />
          <p className="field-hint">Balance above is as at this date.</p>
          {errors.referenceDate && <p className="field-error">{errors.referenceDate}</p>}
        </div>

        <div className="field field-span">
          <label htmlFor="entitlementValue">Leave entitlement</label>
          <div className="input-unit-row">
            <input
              id="entitlementValue"
              type="number"
              inputMode="decimal"
              step="any"
              value={displayValue(config.annualEntitlement, unit)}
              onChange={(e) => {
                const v = numberValue(e.target.value);
                onChange({ annualEntitlement: Number.isFinite(v) ? toAnnual(v, unit) : NaN });
              }}
              aria-invalid={!!errors.annualEntitlement}
            />
            <select
              className="unit-select"
              aria-label="Entitlement unit"
              value={unit}
              onChange={(e) =>
                onChange({ entitlementUnit: e.target.value as EntitlementUnit })
              }
            >
              {ENTITLEMENT_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <p className="field-hint">
            Accrued across weekdays only (not weekends).
            {unit !== 'year' && Number.isFinite(config.annualEntitlement) && (
              <> · ≈ {config.annualEntitlement.toFixed(1)} hours/year</>
            )}
          </p>
          {errors.annualEntitlement && (
            <p className="field-error">{errors.annualEntitlement}</p>
          )}
        </div>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={config.accrueWhileOnLeave}
          onChange={(e) => onChange({ accrueWhileOnLeave: e.target.checked })}
        />
        <span>
          Accrual continues while on annual leave
          <span className="field-hint">
            {config.accrueWhileOnLeave
              ? 'Leave accrues every weekday (never on weekends).'
              : 'Weekday leave days do not accrue (weekends never accrue).'}
          </span>
        </span>
      </label>
    </section>
  );
}

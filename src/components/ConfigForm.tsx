import type { ForecastConfig } from '../types';
import { validateConfig } from '../validation';

interface Props {
  config: ForecastConfig;
  onChange: (patch: Partial<ForecastConfig>) => void;
}

/** Number input that reports NaN for empty/invalid so validation can flag it. */
function numberValue(raw: string): number {
  if (raw.trim() === '') return NaN;
  return Number(raw);
}

export default function ConfigForm({ config, onChange }: Props) {
  const errors = validateConfig(config);

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

        <div className="field">
          <label htmlFor="annualEntitlement">Annual entitlement (hours / year)</label>
          <input
            id="annualEntitlement"
            type="number"
            inputMode="decimal"
            step="any"
            value={Number.isFinite(config.annualEntitlement) ? config.annualEntitlement : ''}
            onChange={(e) => onChange({ annualEntitlement: numberValue(e.target.value) })}
            aria-invalid={!!errors.annualEntitlement}
          />
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
              ? 'Leave accrues every calendar day.'
              : 'Days on planned leave do not accrue.'}
          </span>
        </span>
      </label>
    </section>
  );
}

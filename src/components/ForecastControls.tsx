import type { ForecastConfig } from '../types';
import { addMonths, parseISODate, toISODate } from '../dates';
import { validateConfig } from '../validation';

interface Props {
  config: ForecastConfig;
  onChange: (patch: Partial<ForecastConfig>) => void;
}

const PRESETS = [3, 6, 12, 24];

export default function ForecastControls({ config, onChange }: Props) {
  const errors = validateConfig(config);

  const applyPreset = (months: number) => {
    const ref = parseISODate(config.referenceDate);
    onChange({ forecastEnd: toISODate(addMonths(ref, months)) });
  };

  return (
    <section className="card" aria-labelledby="forecast-heading">
      <h2 id="forecast-heading">Forecast window</h2>

      <div className="preset-row">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            className="btn btn-ghost"
            onClick={() => applyPreset(m)}
          >
            {m} months
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="forecastEnd">Forecast end date</label>
        <input
          id="forecastEnd"
          type="date"
          value={config.forecastEnd}
          min={config.referenceDate}
          onChange={(e) => onChange({ forecastEnd: e.target.value })}
          aria-invalid={!!errors.forecastEnd}
        />
        {errors.forecastEnd && <p className="field-error">{errors.forecastEnd}</p>}
      </div>
    </section>
  );
}

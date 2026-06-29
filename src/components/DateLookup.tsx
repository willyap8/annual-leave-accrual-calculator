import { useState } from 'react';
import type { ForecastConfig } from '../types';
import { balanceAt } from '../accrual';
import { formatHuman, isValidISODate, parseISODate } from '../dates';

interface Props {
  config: ForecastConfig;
}

export default function DateLookup({ config }: Props) {
  const [date, setDate] = useState<string>(config.forecastEnd);

  const valid = isValidISODate(date);
  const beforeRef =
    valid &&
    isValidISODate(config.referenceDate) &&
    parseISODate(date) < parseISODate(config.referenceDate);
  const balance = valid ? balanceAt(date, config) : NaN;

  return (
    <section className="card lookup-card" aria-labelledby="lookup-heading">
      <h2 id="lookup-heading">Balance on a date</h2>
      <div className="field">
        <label htmlFor="lookup-date">Pick any date</label>
        <input
          id="lookup-date"
          type="date"
          value={date}
          min={config.referenceDate}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {valid && (
        <div className="lookup-result">
          <span className="lookup-label">Projected balance on {formatHuman(date)}</span>
          <span className={`lookup-value ${balance < 0 ? 'negative' : ''}`}>
            {balance.toFixed(1)} h
          </span>
          {beforeRef && (
            <span className="field-hint">
              Before the reference date — shows the starting balance.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

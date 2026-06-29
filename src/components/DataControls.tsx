import { useRef, useState } from 'react';
import type { ForecastConfig } from '../types';
import { exportJson, importJson } from '../storage';

interface Props {
  config: ForecastConfig;
  onImport: (config: ForecastConfig) => void;
  onReset: () => void;
}

export default function DataControls({ config, onImport, onReset }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    const blob = new Blob([exportJson(config)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annual-leave-forecast.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      onImport(importJson(text));
      setMessage('Data imported.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import that file.');
    }
  };

  const handleReset = () => {
    if (
      window.confirm(
        'Clear all data and reset to defaults? This cannot be undone (export first if you want a backup).',
      )
    ) {
      onReset();
      setMessage('All data cleared.');
      setError(null);
    }
  };

  return (
    <section className="card data-controls" aria-labelledby="data-heading">
      <h2 id="data-heading">Your data</h2>
      <p className="field-hint">
        Saved automatically in this browser only. Export to back up or move to another device.
      </p>
      <div className="button-row">
        <button type="button" className="btn btn-ghost" onClick={handleExport}>
          Export JSON
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => fileInput.current?.click()}
        >
          Import JSON
        </button>
        <button type="button" className="btn btn-danger" onClick={handleReset}>
          Clear all
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>
      {message && <p className="field-hint data-msg-ok">{message}</p>}
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ForecastConfig } from './types';
import { defaultConfig, clearStorage, loadConfig, saveConfig } from './storage';
import { findFirstNegative } from './accrual';
import { useTheme } from './theme';
import ConfigForm from './components/ConfigForm';
import LeaveList from './components/LeaveList';
import ForecastControls from './components/ForecastControls';
import DateLookup from './components/DateLookup';
import BalanceChart from './components/BalanceChart';
import WarningBanner from './components/WarningBanner';
import DataControls from './components/DataControls';

export default function App() {
  const [config, setConfig] = useState<ForecastConfig>(() => loadConfig());
  const [theme, toggleTheme] = useTheme();
  const firstRender = useRef(true);

  // Debounced autosave: persist whenever the config changes (skip initial load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const id = setTimeout(() => saveConfig(config), 300);
    return () => clearTimeout(id);
  }, [config]);

  const update = (patch: Partial<ForecastConfig>) =>
    setConfig((c) => ({ ...c, ...patch }));

  const handleReset = () => {
    clearStorage();
    setConfig(defaultConfig());
  };

  const negative = useMemo(() => findFirstNegative(config), [config]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Annual Leave Accrual Forecaster</h1>
          <p className="tagline">Project your leave balance over time.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      <WarningBanner negative={negative} />

      <main className="layout">
        <div className="column column-inputs">
          <ConfigForm config={config} onChange={update} />
          <ForecastControls config={config} onChange={update} />
          <DateLookup config={config} />
          <DataControls config={config} onImport={setConfig} onReset={handleReset} />
        </div>
        <div className="column column-output">
          <BalanceChart config={config} negative={negative} theme={theme} />
          <LeaveList leave={config.leave} onChange={(leave) => update({ leave })} />
        </div>
      </main>
    </div>
  );
}

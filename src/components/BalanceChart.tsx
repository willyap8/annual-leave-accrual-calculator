import { useEffect, useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin, { type AnnotationOptions } from 'chartjs-plugin-annotation';
import zoomPlugin from 'chartjs-plugin-zoom';
import type { ForecastConfig, ThemeMode } from '../types';
import type { DateInterval, NegativePoint, SeriesPoint } from '../accrual';
import { formatHuman, parseISODate } from '../dates';

ChartJS.register(
  LinearScale,
  CategoryScale,
  TimeScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  annotationPlugin,
  zoomPlugin,
);

interface Props {
  config: ForecastConfig;
  series: SeriesPoint[];
  unpaidIntervals: DateInterval[];
  negative: NegativePoint | null;
  theme: ThemeMode;
}

/** Palette resolved per theme so the chart matches light/dark CSS variables. */
function palette(theme: ThemeMode) {
  const dark = theme === 'dark';
  return {
    line: dark ? '#6ea8fe' : '#2563eb',
    fill: dark ? 'rgba(110,168,254,0.12)' : 'rgba(37,99,235,0.10)',
    grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: dark ? '#cbd5e1' : '#475569',
    leave: dark ? 'rgba(250,204,21,0.14)' : 'rgba(234,179,8,0.16)',
    leaveBorder: dark ? 'rgba(250,204,21,0.35)' : 'rgba(202,138,4,0.4)',
    unpaid: dark ? 'rgba(248,113,113,0.18)' : 'rgba(220,38,38,0.14)',
    unpaidBorder: dark ? 'rgba(248,113,113,0.45)' : 'rgba(220,38,38,0.4)',
    danger: dark ? '#f87171' : '#dc2626',
    zero: dark ? 'rgba(248,113,113,0.5)' : 'rgba(220,38,38,0.45)',
    tooltipBg: dark ? '#1e293b' : '#ffffff',
  };
}

export default function BalanceChart({
  config,
  series,
  unpaidIntervals,
  negative,
  theme,
}: Props) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const colors = palette(theme);

  const data: ChartData<'line'> = useMemo(
    () => ({
      datasets: [
        {
          label: 'Projected balance (h)',
          data: series.map((p) => ({ x: parseISODate(p.date).getTime(), y: p.balance })),
          borderColor: colors.line,
          backgroundColor: colors.fill,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0,
        },
      ],
    }),
    [series, colors.line, colors.fill],
  );

  const annotations = useMemo(() => {
    const items: Record<string, AnnotationOptions> = {};

    // Shaded region for each planned-leave period.
    config.leave.forEach((e, i) => {
      const start = parseISODate(e.start).getTime();
      const end = parseISODate(e.end).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) return;
      items[`leave-${i}`] = {
        type: 'box',
        xMin: start,
        xMax: end,
        backgroundColor: colors.leave,
        borderColor: colors.leaveBorder,
        borderWidth: 1,
        label: {
          display: !!e.label?.trim(),
          content: e.label?.trim() ?? '',
          position: 'start',
          color: colors.text,
          font: { size: 10 },
        },
      };
    });

    // Shaded region for each unpaid-leave stretch (drawn over the leave box).
    unpaidIntervals.forEach((iv, i) => {
      const start = parseISODate(iv.start).getTime();
      const end = parseISODate(iv.end).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) return;
      items[`unpaid-${i}`] = {
        type: 'box',
        xMin: start,
        xMax: end,
        backgroundColor: colors.unpaid,
        borderColor: colors.unpaidBorder,
        borderWidth: 1,
        label: {
          display: i === 0,
          content: 'Unpaid leave',
          position: { x: 'center', y: 'end' },
          color: colors.danger,
          font: { size: 10 },
        },
      };
    });

    // Zero threshold line.
    items.zero = {
      type: 'line',
      yMin: 0,
      yMax: 0,
      borderColor: colors.zero,
      borderWidth: 1,
      borderDash: [4, 4],
    };

    // Marker at the first negative date.
    if (negative) {
      items.negative = {
        type: 'line',
        xMin: parseISODate(negative.date).getTime(),
        xMax: parseISODate(negative.date).getTime(),
        borderColor: colors.danger,
        borderWidth: 2,
        label: {
          display: true,
          content: 'Goes negative',
          position: 'start',
          backgroundColor: colors.danger,
          color: '#fff',
          font: { size: 10 },
        },
      };
    }

    return items;
  }, [config.leave, unpaidIntervals, negative, colors]);

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', tooltipFormat: 'd MMM yyyy' },
          grid: { color: colors.grid },
          ticks: { color: colors.text, maxRotation: 0, autoSkip: true },
        },
        y: {
          title: { display: true, text: 'Hours', color: colors.text },
          grid: { color: colors.grid },
          ticks: { color: colors.text },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.text,
          bodyColor: colors.text,
          borderColor: colors.grid,
          borderWidth: 1,
          callbacks: {
            title: (items) =>
              formatHuman(new Date(Number(items[0].parsed.x)).toISOString().slice(0, 10)),
            label: (item) => `${(item.parsed.y ?? 0).toFixed(1)} h`,
          },
        },
        annotation: { annotations },
        zoom: {
          pan: { enabled: true, mode: 'x', modifierKey: undefined },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true }, // touch / mobile pinch-zoom
            drag: { enabled: false },
            mode: 'x',
          },
          limits: { x: { minRange: 7 * 24 * 60 * 60 * 1000 } },
        },
      },
    }),
    [annotations, colors],
  );

  // Reset zoom when the underlying window changes substantially.
  useEffect(() => {
    chartRef.current?.resetZoom();
  }, [config.referenceDate, config.forecastEnd]);

  return (
    <section className="card chart-card" aria-labelledby="chart-heading">
      <div className="chart-header">
        <h2 id="chart-heading">Forecast</h2>
        <div className="chart-zoom-controls">
          <button
            type="button"
            className="btn btn-ghost btn-small btn-icon"
            onClick={() => chartRef.current?.zoom(0.8)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small btn-icon"
            onClick={() => chartRef.current?.zoom(1.25)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => chartRef.current?.resetZoom()}
          >
            Reset zoom
          </button>
        </div>
      </div>
      <p className="field-hint chart-hint">
        Scroll or pinch to zoom · drag to pan · hover or tap for details.
      </p>
      <div className="chart-canvas-wrap">
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </section>
  );
}

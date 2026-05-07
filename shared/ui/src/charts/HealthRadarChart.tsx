import type { RadarMetric } from './legacyTypes.js';
import { RadarChart } from './RadarChart.js';

export interface HealthRadarChartProps {
  /** Browser-shape radar metrics — value is 0..1. */
  metrics: RadarMetric[];
  size?: number;
}

function barColor(value: number): string {
  if (value >= 0.7) return 'bg-emerald-400';
  if (value >= 0.4) return 'bg-amber-400';
  return 'bg-red-400';
}

/**
 * Radar chart with the per-metric grid below — the in-browser repoguru
 * RadarHealthCard composition, lifted as the canonical "health" view.
 */
export function HealthRadarChart({ metrics, size = 300 }: HealthRadarChartProps) {
  if (metrics.length === 0) return null;

  const radarData = metrics.map((m) => ({
    label: m.label,
    value: m.value * 100,
    max: 100,
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <RadarChart data={radarData} size={size} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const pct = Math.round(m.value * 100);
          return (
            <div key={m.label} className="p-3 rounded-lg border border-border bg-surface-alt">
              <div className="text-xs text-text-muted font-medium mb-1 truncate">{m.label}</div>
              <div className="text-lg font-bold text-text">{pct}%</div>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(m.value)} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

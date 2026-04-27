import type { HealthSection } from '@repoguru/core';
import { RadarChart } from './RadarChart.js';

export interface HealthRadarChartProps {
  /** Canonical radar metrics. The chart auto-detects 0..1 vs 0..100 ranges. */
  metrics: HealthSection['radarMetrics'];
  size?: number;
}

function barColor(ratio: number): string {
  if (ratio >= 0.7) return 'bg-emerald-400';
  if (ratio >= 0.4) return 'bg-amber-400';
  return 'bg-red-400';
}

/**
 * Radar plus a per-metric grid below — the in-browser repoguru
 * RadarHealthCard composition, lifted as the canonical "health" view
 * for both apps.
 */
export function HealthRadarChart({ metrics, size = 300 }: HealthRadarChartProps) {
  if (metrics.length === 0) return null;

  // Adapter contract: canonical RadarMetric.value is 0..100. The desktop
  // adapter currently passes through 0..1 via the gRPC sidecar — detect
  // and rescale for display.
  const looksZeroToOne = metrics.every((m) => m.value <= 1);
  const radarData = metrics.map((m) => ({
    label: m.label,
    value: looksZeroToOne ? m.value * 100 : m.value,
    max: 100,
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <RadarChart data={radarData} size={size} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m) => {
          const ratio = looksZeroToOne ? m.value : m.value / 100;
          const pct = Math.round(ratio * 100);
          return (
            <div
              key={m.label}
              className="p-3 rounded-lg border border-border bg-surface-alt"
            >
              <div className="text-xs text-text-muted font-medium mb-1 truncate">{m.label}</div>
              <div className="text-lg font-bold text-text">{pct}%</div>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(ratio)} transition-all duration-500`}
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

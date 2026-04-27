import { HealthRadarChart } from '@repoguru/ui';
import type { HealthSection } from '@repoguru/core';

interface Props {
  radarMetrics: HealthSection['radarMetrics'];
}

function barColor(value: number): string {
  if (value >= 0.7) return 'bg-emerald-400';
  if (value >= 0.4) return 'bg-amber-400';
  return 'bg-red-400';
}

export function RadarHealthCard({ radarMetrics }: Props) {
  if (radarMetrics.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <HealthRadarChart metrics={radarMetrics} max={1} card={false} height={300} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {radarMetrics.map((m) => {
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

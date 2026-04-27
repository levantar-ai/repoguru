import type { RadarMetric } from '../../types/gitStats';

interface Props {
  radarMetrics: RadarMetric[];
  totalCommits: number;
  contributors: number;
  busFactor: number;
  repoAgeDays: number;
}

function getGrade(score: number): { letter: string; color: string } {
  if (score >= 80) return { letter: 'A', color: 'text-emerald-400' };
  if (score >= 60) return { letter: 'B', color: 'text-sky-400' };
  if (score >= 40) return { letter: 'C', color: 'text-amber-400' };
  if (score >= 20) return { letter: 'D', color: 'text-orange-400' };
  return { letter: 'F', color: 'text-red-400' };
}

function formatAge(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`;
  if (days >= 30) return `${Math.floor(days / 30)} months`;
  return `${days} days`;
}

export function ExecutiveSummary({
  radarMetrics,
  totalCommits,
  contributors,
  busFactor,
  repoAgeDays,
}: Props) {
  const healthScore =
    radarMetrics.length > 0
      ? Math.round((radarMetrics.reduce((sum, m) => sum + m.value, 0) / radarMetrics.length) * 100)
      : 0;

  const grade = getGrade(healthScore);

  // SVG donut parameters
  const donutSize = 140;
  const strokeWidth = 10;
  const radius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  const strengths = radarMetrics.filter((m) => m.value > 0.7);
  const weaknesses = radarMetrics.filter((m) => m.value < 0.3);

  const kpis = [
    { label: 'Total Commits', value: totalCommits.toLocaleString() },
    { label: 'Contributors', value: contributors.toLocaleString() },
    { label: 'Bus Factor', value: busFactor.toString() },
    { label: 'Repo Age', value: formatAge(repoAgeDays) },
  ];

  return (
    <div className="p-6 rounded-xl border border-border bg-surface-alt space-y-6">
      {/* Score + Donut */}
      <div className="flex items-center gap-8">
        <div className="relative flex-shrink-0">
          <svg width={donutSize} height={donutSize} className="-rotate-90">
            <circle
              cx={donutSize / 2}
              cy={donutSize / 2}
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={donutSize / 2}
              cy={donutSize / 2}
              r={radius}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-text">{healthScore}</span>
            <span className={`text-lg font-semibold ${grade.color}`}>{grade.letter}</span>
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-text">Health Score</h3>
          <p className="text-sm text-text-muted mt-1">
            Aggregated from {radarMetrics.length} dimensions
          </p>
        </div>
      </div>

      {/* KPI badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="px-4 py-3 rounded-lg border border-border bg-surface text-center"
          >
            <div className="text-xs text-text-muted font-medium uppercase tracking-wider mb-1">
              {kpi.label}
            </div>
            <div className="text-xl font-bold text-text">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Finding pills */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="space-y-3">
          {strengths.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider mr-1">
                Strengths
              </span>
              {strengths.map((m) => (
                <span
                  key={m.label}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                >
                  {m.label}
                </span>
              ))}
            </div>
          )}
          {weaknesses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider mr-1">
                Weaknesses
              </span>
              {weaknesses.map((m) => (
                <span
                  key={m.label}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20"
                >
                  {m.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import type { GitStatsAnalysis } from '../../types/gitStats';

interface Props {
  analysis: GitStatsAnalysis;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function StatsOverviewCards({ analysis }: Props) {
  // Most active day of week
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const wa of analysis.weeklyActivity) {
    wa.days.forEach((count, i) => {
      dayTotals[i] += count;
    });
  }
  const mostActiveDay = dayTotals.indexOf(Math.max(...dayTotals));

  // Average commit size from distribution
  let totalSize = 0;
  let totalCount = 0;
  for (const bucket of analysis.commitSizeDistribution.buckets) {
    const midpoint = bucket.max === Infinity ? 2000 : (bucket.min + bucket.max) / 2;
    totalSize += midpoint * bucket.count;
    totalCount += bucket.count;
  }
  const avgCommitSize = totalCount > 0 ? Math.round(totalSize / totalCount) : 0;

  const cards = [
    {
      label: 'Total Commits',
      value: analysis.totalCommits.toLocaleString(),
      accent: false,
    },
    {
      label: 'Lines of Code',
      value: analysis.totalLinesOfCode > 0 ? analysis.totalLinesOfCode.toLocaleString() : 'N/A',
      accent: false,
    },
    {
      label: 'Contributors',
      value: analysis.contributors.length.toLocaleString(),
      accent: false,
    },
    {
      label: 'Bus Factor',
      value: analysis.busFactor.busFactor.toString(),
      accent: analysis.busFactor.busFactor <= 2,
    },
    {
      label: 'Most Active Day',
      value: DAY_NAMES[mostActiveDay] || 'N/A',
      accent: false,
    },
    {
      label: 'Avg Commit Size',
      value: `${avgCommitSize} lines`,
      accent: false,
    },
    {
      label: 'Languages',
      value: analysis.languages.length.toString(),
      accent: false,
    },
    ...(analysis.firstCommitDate
      ? [
          {
            label: 'First Commit',
            value: new Date(analysis.firstCommitDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            }),
            accent: false,
          },
        ]
      : []),
    ...(analysis.repoAgeDays > 0
      ? [
          {
            label: 'Repo Age',
            value: (() => {
              if (analysis.repoAgeDays >= 365)
                return `${Math.floor(analysis.repoAgeDays / 365)}y ${Math.floor((analysis.repoAgeDays % 365) / 30)}m`;
              if (analysis.repoAgeDays >= 30)
                return `${Math.floor(analysis.repoAgeDays / 30)} months`;
              return `${analysis.repoAgeDays} days`;
            })(),
            accent: false,
          },
        ]
      : []),
    ...(analysis.binaryFileCount > 0
      ? [
          {
            label: 'Binary Files',
            value: analysis.binaryFileCount.toLocaleString(),
            accent: false,
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="p-5 rounded-xl border border-border bg-surface-alt">
          <div className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2">
            {card.label}
          </div>
          <div className={`text-2xl font-bold ${card.accent ? 'text-grade-c' : 'text-text'}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

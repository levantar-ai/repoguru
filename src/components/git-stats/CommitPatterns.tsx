import { useMemo } from 'react';
import type { CommitMessageStats } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  commitMessages: CommitMessageStats;
}

export function CommitPatterns({ commitMessages }: Props) {
  const donutOption = useMemo(() => {
    const cc = commitMessages.conventionalCommits;
    const entries = Object.entries(cc).filter(([, v]) => v > 0);

    if (entries.length === 0) return null;

    const colors: Record<string, string> = {
      feat: '#34d399',
      fix: '#f87171',
      docs: '#38bdf8',
      style: '#f472b6',
      refactor: '#a78bfa',
      test: '#fbbf24',
      chore: '#94a3b8',
      ci: '#fb923c',
      perf: '#a3e635',
      build: '#64748b',
      other: '#475569',
    };

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: '{b}: {c} ({d}%)',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: '#0f172a',
            borderWidth: 2,
            borderRadius: 4,
          },
          label: {
            color: '#94a3b8',
            fontSize: 11,
          },
          data: entries.map(([type, count]) => ({
            name: type,
            value: count,
            itemStyle: { color: colors[type] || '#64748b' },
          })),
        },
      ],
    };
  }, [commitMessages]);

  const stats = commitMessages;

  let conventionalColor: string;
  if (stats.conventionalPercentage >= 50) {
    conventionalColor = 'text-grade-a';
  } else if (stats.conventionalPercentage >= 20) {
    conventionalColor = 'text-grade-c';
  } else {
    conventionalColor = 'text-text-muted';
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Stat cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-surface-hover border border-border">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Total Commits
            </div>
            <div className="text-xl font-bold text-text">{stats.totalCommits.toLocaleString()}</div>
          </div>
          <div className="p-4 rounded-lg bg-surface-hover border border-border">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Merge Commits
            </div>
            <div className="text-xl font-bold text-text">
              {stats.mergeCommitCount.toLocaleString()}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {stats.totalCommits > 0
                ? `${Math.round((stats.mergeCommitCount / stats.totalCommits) * 100)}% of total`
                : ''}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-surface-hover border border-border">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Avg Message Length
            </div>
            <div className="text-xl font-bold text-text">{stats.averageLength}</div>
            <div className="text-xs text-text-muted mt-0.5">characters</div>
          </div>
          <div className="p-4 rounded-lg bg-surface-hover border border-border">
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Conventional
            </div>
            <div className={`text-xl font-bold ${conventionalColor}`}>
              {stats.conventionalPercentage}%
            </div>
            <div className="text-xs text-text-muted mt-0.5">of commits</div>
          </div>
        </div>
      </div>

      {/* Conventional commit type chart */}
      <div>
        {donutOption ? (
          <>
            <h4 className="text-sm font-semibold text-text-secondary mb-2">Commit Types</h4>
            <EChartsWrapper option={donutOption} height="250px" />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-muted">
            No conventional commits detected
          </div>
        )}
      </div>
    </div>
  );
}

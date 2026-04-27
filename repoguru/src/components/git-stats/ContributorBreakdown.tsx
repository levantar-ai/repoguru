import { useMemo } from 'react';
import type { ContributorSummary } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';
import { CHART_COLORS } from '../../utils/echartsTheme';

interface Props {
  contributors: ContributorSummary[];
}

export function ContributorBreakdown({ contributors }: Props) {
  const barOption = useMemo(() => {
    const top15 = contributors.slice(0, 15);
    const logins = top15.map((c) => c.login);
    const reversedLogins = [...logins];
    reversedLogins.reverse();
    const commits = top15.map((c) => c.totalCommits);
    const reversedCommits = [...commits];
    reversedCommits.reverse();

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const p = params[0];
          const contributor = top15.find((c) => c.login === p.name);
          if (!contributor) return '';
          return `<b>${p.name}</b><br/>
            Commits: ${p.value}<br/>
            Additions: ${contributor.totalAdditions.toLocaleString()}<br/>
            Deletions: ${contributor.totalDeletions.toLocaleString()}<br/>
            Share: ${contributor.commitPercentage.toFixed(1)}%`;
        },
      },
      grid: {
        left: 120,
        right: 40,
        top: 10,
        bottom: 10,
      },
      xAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      yAxis: {
        type: 'category' as const,
        data: reversedLogins,
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          width: 100,
          overflow: 'truncate' as const,
        },
      },
      series: [
        {
          type: 'bar',
          data: reversedCommits,
          barMaxWidth: 24,
          itemStyle: {
            color: (params: { dataIndex: number }) => {
              return CHART_COLORS[params.dataIndex % CHART_COLORS.length];
            },
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    };
  }, [contributors]);

  const pieOption = useMemo(() => {
    const top10 = contributors.slice(0, 10);
    const othersCommits = contributors.slice(10).reduce((sum, c) => sum + c.totalCommits, 0);

    const data = top10.map((c) => ({
      name: c.login,
      value: c.totalCommits,
    }));

    if (othersCommits > 0) {
      data.push({ name: 'Others', value: othersCommits });
    }

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
            formatter: '{b}\n{d}%',
          },
          labelLine: {
            lineStyle: { color: '#475569' },
          },
          data,
        },
      ],
    };
  }, [contributors]);

  if (contributors.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <h4 className="text-sm font-semibold text-text-secondary mb-3">
          Top Contributors (by commits)
        </h4>
        <EChartsWrapper
          option={barOption}
          height={`${Math.max(300, Math.min(contributors.length, 15) * 30)}px`}
        />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-text-secondary mb-3">Commit Distribution</h4>
        <EChartsWrapper option={pieOption} height="300px" />
      </div>
    </div>
  );
}

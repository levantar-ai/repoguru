import { useMemo } from 'react';
import type { CommitSizeDistribution } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  distribution: CommitSizeDistribution;
}

export function CommitSizeHistogram({ distribution }: Props) {
  const option = useMemo(() => {
    const labels = distribution.buckets.map((b) => b.label);
    const counts = distribution.buckets.map((b) => b.count);
    const total = counts.reduce((a, b) => a + b, 0);

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: Array<{ name: string; value: number }>) => {
          const p = params[0];
          const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : '0';
          return `<b>${p.name} lines</b><br/>${p.value} commits (${pct}%)`;
        },
      },
      grid: {
        left: 50,
        right: 20,
        top: 20,
        bottom: 40,
      },
      xAxis: {
        type: 'category' as const,
        data: labels,
        axisLabel: { color: '#64748b', fontSize: 11 },
        name: 'Lines Changed',
        nameLocation: 'center' as const,
        nameGap: 28,
        nameTextStyle: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
        name: 'Commits',
        nameTextStyle: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: counts,
          barMaxWidth: 40,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#38bdf8' },
                { offset: 1, color: '#0284c7' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    };
  }, [distribution]);

  if (distribution.buckets.every((b) => b.count === 0)) return null;

  return <EChartsWrapper option={option} height="300px" />;
}

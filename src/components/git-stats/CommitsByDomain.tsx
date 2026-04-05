import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  commitsByDomain: { domain: string; count: number }[];
}

export function CommitsByDomain({ commitsByDomain }: Props) {
  const top = commitsByDomain.slice(0, 15);

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      grid: { left: 120, right: 20, top: 10, bottom: 20 },
      xAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      yAxis: {
        type: 'category' as const,
        data: [...top].reverse().map((d) => d.domain),
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: [...top].reverse().map((d) => d.count),
          barMaxWidth: 24,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#7c3aed' },
                { offset: 1, color: '#a78bfa' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    }),
    [top],
  );

  if (commitsByDomain.length === 0) return null;
  return <EChartsWrapper option={option} height={`${Math.max(200, top.length * 28)}px`} />;
}

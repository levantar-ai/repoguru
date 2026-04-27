import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  commitsByYear: { year: number; count: number }[];
}

export function CommitsByYear({ commitsByYear }: Props) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: commitsByYear.map((d) => d.year.toString()),
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: commitsByYear.map((d) => d.count),
          barMaxWidth: 50,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#fb923c' },
                { offset: 1, color: '#ea580c' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }),
    [commitsByYear],
  );

  if (commitsByYear.length === 0) return null;
  return <EChartsWrapper option={option} height="280px" />;
}

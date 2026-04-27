import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  commitsByExtension: { ext: string; count: number }[];
}

export function CommitsByExtension({ commitsByExtension }: Props) {
  const top = commitsByExtension.slice(0, 15);

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      grid: { left: 80, right: 20, top: 10, bottom: 20 },
      xAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      yAxis: {
        type: 'category' as const,
        data: [...top].reverse().map((d) => d.ext),
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
                { offset: 0, color: '#0284c7' },
                { offset: 1, color: '#38bdf8' },
              ],
            },
            borderRadius: [0, 4, 4, 0],
          },
        },
      ],
    }),
    [top],
  );

  if (commitsByExtension.length === 0) return null;
  return <EChartsWrapper option={option} height={`${Math.max(200, top.length * 28)}px`} />;
}

import { useMemo } from 'react';
import type { PatternsSection } from '@repoguru/core';
import { EChartsWrapper } from './EChartsWrapper.js';

export interface CommitsByYearChartProps {
  /** Canonical commits-by-year — `{ year, count }[]`, sorted ascending. */
  data: PatternsSection['commitsByYear'];
  height?: string;
}

export function CommitsByYearChart({ data, height = '280px' }: CommitsByYearChartProps) {
  const option = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.year - b.year);
    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: sorted.map((d) => String(d.year)),
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((d) => d.count),
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
    };
  }, [data]);

  if (data.length === 0) return null;
  return <EChartsWrapper option={option} height={height} />;
}

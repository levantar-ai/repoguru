import { useMemo } from 'react';
import type { PatternsSection } from '@repoguru/core';
import { EChartsWrapper } from './EChartsWrapper.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CommitsByWeekdayChartProps {
  /** Per the canonical contract: length 7, Sun=0..Sat=6. */
  data: PatternsSection['commitsByWeekday'];
  height?: string;
}

export function CommitsByWeekdayChart({
  data,
  height = '280px',
}: CommitsByWeekdayChartProps) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: DAY_LABELS,
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: [...data],
          barMaxWidth: 40,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#a78bfa' },
                { offset: 1, color: '#7c3aed' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }),
    [data],
  );

  if (data.every((c) => c === 0)) return null;
  return <EChartsWrapper option={option} height={height} />;
}

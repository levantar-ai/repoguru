import { useMemo } from 'react';
import type { PatternsSection } from '@repoguru/core';
import { EChartsWrapper } from './EChartsWrapper.js';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface CommitsByMonthChartProps {
  /** Per the canonical contract: length 12, Jan=0..Dec=11. */
  data: PatternsSection['commitsByMonth'];
  height?: string;
}

export function CommitsByMonthChart({ data, height = '280px' }: CommitsByMonthChartProps) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: MONTH_LABELS,
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
          barMaxWidth: 36,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#34d399' },
                { offset: 1, color: '#059669' },
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

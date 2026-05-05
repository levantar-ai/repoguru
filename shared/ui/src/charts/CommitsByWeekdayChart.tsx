import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CommitsByWeekdayChartProps {
  /** Length 7, Sun=0..Sat=6. */
  commitsByWeekday: number[];
  height?: string;
}

export function CommitsByWeekdayChart({
  commitsByWeekday,
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
      yAxis: { type: 'value' as const, axisLabel: { color: '#64748b' } },
      series: [
        {
          type: 'bar',
          data: commitsByWeekday,
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
    [commitsByWeekday],
  );

  if (commitsByWeekday.every((c) => c === 0)) return null;
  return <EChartsWrapper option={option} height={height} />;
}

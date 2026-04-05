import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  commitsByHour: number[];
}

const HOUR_LABELS = [
  '12a',
  '1a',
  '2a',
  '3a',
  '4a',
  '5a',
  '6a',
  '7a',
  '8a',
  '9a',
  '10a',
  '11a',
  '12p',
  '1p',
  '2p',
  '3p',
  '4p',
  '5p',
  '6p',
  '7p',
  '8p',
  '9p',
  '10p',
  '11p',
];

export function CommitsByHour({ commitsByHour }: Props) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: HOUR_LABELS,
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: commitsByHour,
          barMaxWidth: 24,
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
    }),
    [commitsByHour],
  );

  if (commitsByHour.every((c) => c === 0)) return null;
  return <EChartsWrapper option={option} height="300px" />;
}

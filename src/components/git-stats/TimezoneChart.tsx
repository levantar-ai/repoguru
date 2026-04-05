import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  timezoneData: { offset: number; count: number }[];
}

export function TimezoneChart({ timezoneData }: Props) {
  const sorted = useMemo(
    () => [...timezoneData].sort((a, b) => a.offset - b.offset),
    [timezoneData],
  );

  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: { name: string; value: number }[]) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/>Commits: <b>${p.value.toLocaleString()}</b>`;
        },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category' as const,
        data: sorted.map((d) => {
          const sign = d.offset >= 0 ? '+' : '';
          return `UTC${sign}${d.offset}`;
        }),
        axisLabel: { color: '#64748b', fontSize: 11, rotate: sorted.length > 12 ? 45 : 0 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((d) => d.count),
          barMaxWidth: 40,
          itemStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#22d3ee' },
                { offset: 1, color: '#0891b2' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    }),
    [sorted],
  );

  if (timezoneData.length === 0) return null;
  return <EChartsWrapper option={option} height="300px" />;
}

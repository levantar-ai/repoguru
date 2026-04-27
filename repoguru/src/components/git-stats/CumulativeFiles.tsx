import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  cumulativeFiles: { date: string; count: number }[];
}

export function CumulativeFiles({ cumulativeFiles }: Props) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        formatter: (params: { name: string; value: number }[]) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/>Files: <b>${p.value.toLocaleString()}</b>`;
        },
      },
      grid: { left: 60, right: 20, top: 10, bottom: 60 },
      xAxis: {
        type: 'category' as const,
        data: cumulativeFiles.map((d) => d.date),
        axisLabel: { color: '#64748b', fontSize: 11, rotate: 45 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 20, bottom: 5 },
      ],
      series: [
        {
          type: 'line',
          data: cumulativeFiles.map((d) => d.count),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: '#34d399', width: 2 },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(52, 211, 153, 0.4)' },
                { offset: 1, color: 'rgba(52, 211, 153, 0.05)' },
              ],
            },
          },
        },
      ],
    }),
    [cumulativeFiles],
  );

  if (cumulativeFiles.length === 0) return null;
  return <EChartsWrapper option={option} height="350px" />;
}

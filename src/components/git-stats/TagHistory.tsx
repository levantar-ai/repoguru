import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';
import type { TagSummary } from '../../types/gitStats';

interface Props {
  tagHistory: TagSummary[];
}

export function TagHistory({ tagHistory }: Props) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: { name: string; value: number }[]) => {
          const p = Array.isArray(params) ? params[0] : params;
          return `${p.name}<br/>Commits since prev: <b>${p.value.toLocaleString()}</b>`;
        },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 60 },
      xAxis: {
        type: 'category' as const,
        data: tagHistory.map((t) => t.name),
        axisLabel: { color: '#64748b', fontSize: 11, rotate: 45 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      series: [
        {
          type: 'bar',
          data: tagHistory.map((t) => t.commitsSincePrev),
          barMaxWidth: 40,
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
    [tagHistory],
  );

  if (tagHistory.length === 0) return null;
  return <EChartsWrapper option={option} height="350px" />;
}

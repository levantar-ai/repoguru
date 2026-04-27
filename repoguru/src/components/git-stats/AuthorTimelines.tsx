import { useMemo } from 'react';
import type { AuthorTimeline } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

const PALETTE = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6'];

interface Props {
  authorTimelines: AuthorTimeline[];
}

export function AuthorTimelines({ authorTimelines }: Props) {
  const option = useMemo(() => {
    // Collect all unique months across all authors, sorted
    const monthSet = new Set<string>();
    for (const at of authorTimelines) {
      for (const [month] of at.points) {
        monthSet.add(month);
      }
    }
    const months = Array.from(monthSet).sort((a, b) => a.localeCompare(b));

    const series = authorTimelines.map((at, i) => {
      const lookup = new Map(at.points);
      return {
        name: at.authorName,
        type: 'line' as const,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: PALETTE[i % PALETTE.length] },
        itemStyle: { color: PALETTE[i % PALETTE.length] },
        data: months.map((m) => lookup.get(m) ?? 0),
      };
    });

    return {
      tooltip: {
        trigger: 'axis' as const,
      },
      legend: {
        data: authorTimelines.map((at) => at.authorName),
        textStyle: { color: '#94a3b8', fontSize: 11 },
        bottom: 0,
      },
      grid: { left: 50, right: 20, top: 10, bottom: 40 },
      xAxis: {
        type: 'category' as const,
        data: months,
        axisLabel: { color: '#64748b', fontSize: 10, rotate: 45 },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: { color: '#64748b' },
      },
      series,
    };
  }, [authorTimelines]);

  if (authorTimelines.length === 0) return null;

  return <EChartsWrapper option={option} height="400px" />;
}

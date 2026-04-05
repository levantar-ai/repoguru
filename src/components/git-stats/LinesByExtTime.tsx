import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';
import type { ExtMonthlyChurn } from '../../types/gitStats';

interface Props {
  linesByExtTime: ExtMonthlyChurn | null;
}

const COLORS = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#facc15',
  '#22d3ee',
  '#818cf8',
  '#4ade80',
  '#f87171',
];

export function LinesByExtTime({ linesByExtTime }: Props) {
  const option = useMemo(() => {
    if (!linesByExtTime) return null;

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'cross' as const },
      },
      legend: {
        data: linesByExtTime.extensions,
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
      },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      xAxis: {
        type: 'category' as const,
        data: linesByExtTime.months,
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
      series: linesByExtTime.extensions.map((ext, i) => ({
        name: ext,
        type: 'line',
        stack: 'total',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1 },
        areaStyle: { opacity: 0.4 },
        itemStyle: { color: COLORS[i % COLORS.length] },
        data: linesByExtTime.data[i],
      })),
    };
  }, [linesByExtTime]);

  if (!linesByExtTime || !option) return null;
  return <EChartsWrapper option={option} height="350px" />;
}

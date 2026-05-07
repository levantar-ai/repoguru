import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';
import type { CategoryScore } from '@/services/grpc-client';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

interface Props {
  categories: CategoryScore[];
  size?: number;
  className?: string;
}

export function RadarChart({ categories, size = 280, className = '' }: Props) {
  const option = useMemo(
    () => ({
      radar: {
        indicator: categories.map((c) => ({ name: c.label, max: 100 })),
        shape: 'polygon',
        splitNumber: 4,
        axisName: {
          color: '#94a3b8',
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: '#334155' } },
        splitArea: {
          areaStyle: { color: ['transparent', 'rgba(56, 189, 248, 0.02)'] },
        },
        axisLine: { lineStyle: { color: '#334155' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: categories.map((c) => c.score),
              name: 'Score',
              areaStyle: {
                color: 'rgba(56, 189, 248, 0.15)',
              },
              lineStyle: {
                color: '#38bdf8',
                width: 2,
              },
              itemStyle: {
                color: (params: { dataIndex: number }) => {
                  const cat = categories[params.dataIndex];
                  return cat ? GRADE_COLORS[cat.grade] || '#38bdf8' : '#38bdf8';
                },
              },
              symbol: 'circle',
              symbolSize: 6,
            },
          ],
        },
      ],
      tooltip: {
        trigger: 'item',
      },
    }),
    [categories],
  );

  return <EChartsWrapper option={option} height={`${size}px`} className={className} />;
}

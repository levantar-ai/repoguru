import ReactECharts from 'echarts-for-react';
import type { PatternsSection } from '@repoguru/core';
import { baseOption } from './echartsTheme.js';
import { ChartCard } from './ChartCard.js';

export interface CommitsByHourChartProps {
  /** Per the canonical contract: length 24, hour 0..23. */
  data: PatternsSection['commitsByHour'];
  height?: number;
  title?: string;
  subtitle?: string;
  /** Wrap the chart in a ChartCard. Set false when the host already
   *  supplies card chrome around the chart. */
  card?: boolean;
}

export function CommitsByHourChart({
  data,
  height = 250,
  title = 'Commits by Hour',
  subtitle = 'Green = work hours, Purple = evening',
  card = true,
}: CommitsByHourChartProps) {
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
    xAxis: {
      type: 'category',
      data: hours,
      axisLabel: { color: '#64748b', fontSize: 10, interval: 2 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        type: 'bar',
        data: [...data],
        itemStyle: {
          color: (params: { dataIndex: number }) => {
            const h = params.dataIndex;
            if (h >= 9 && h <= 17) return '#34d399';
            if (h >= 18 && h <= 22) return '#a78bfa';
            return '#64748b';
          },
        },
        barWidth: '70%',
      },
    ],
  });

  const chart = <ReactECharts option={option} style={{ height }} />;
  if (!card) return chart;
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {chart}
    </ChartCard>
  );
}

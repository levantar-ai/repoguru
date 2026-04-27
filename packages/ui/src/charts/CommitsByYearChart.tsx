import ReactECharts from 'echarts-for-react';
import type { PatternsSection } from '@repoguru/core';
import { baseOption } from './echartsTheme.js';
import { ChartCard } from './ChartCard.js';

export interface CommitsByYearChartProps {
  /** Canonical commits-by-year — `{ year, count }[]`, sorted in ascending year order. */
  data: PatternsSection['commitsByYear'];
  height?: number;
  title?: string;
  /** Wrap the chart in a ChartCard. Set false when the host already
   *  supplies card chrome around the chart. */
  card?: boolean;
}

export function CommitsByYearChart({
  data,
  height = 250,
  title = 'Commits by Year',
  card = true,
}: CommitsByYearChartProps) {
  const sorted = [...data].sort((a, b) => a.year - b.year);
  const years = sorted.map((d) => String(d.year));
  const values = sorted.map((d) => d.count);

  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
    xAxis: {
      type: 'category',
      data: years,
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(56,189,248,0.3)' },
              { offset: 1, color: 'rgba(56,189,248,0)' },
            ],
          },
        },
        lineStyle: { color: '#38bdf8', width: 2 },
        itemStyle: { color: '#38bdf8' },
      },
    ],
  });

  const chart = <ReactECharts option={option} style={{ height }} />;
  if (!card) return chart;
  return <ChartCard title={title}>{chart}</ChartCard>;
}

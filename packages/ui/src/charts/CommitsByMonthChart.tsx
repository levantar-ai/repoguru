import ReactECharts from 'echarts-for-react';
import type { PatternsSection } from '@repoguru/core';
import { baseOption } from './echartsTheme.js';
import { ChartCard } from './ChartCard.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface CommitsByMonthChartProps {
  /** Per the canonical contract: length 12, Jan=0..Dec=11. */
  data: PatternsSection['commitsByMonth'];
  /** Override the month labels (e.g. for non-English locales). */
  monthLabels?: readonly string[];
  height?: number;
  title?: string;
  /** Wrap the chart in a ChartCard. Set false when the host already
   *  supplies card chrome around the chart. */
  card?: boolean;
}

export function CommitsByMonthChart({
  data,
  monthLabels = MONTHS,
  height = 250,
  title = 'Commits by Month',
  card = true,
}: CommitsByMonthChartProps) {
  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
    xAxis: {
      type: 'category',
      data: [...monthLabels],
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
        type: 'bar',
        data: [...data],
        itemStyle: { color: '#a78bfa' },
        barWidth: '60%',
      },
    ],
  });

  const chart = <ReactECharts option={option} style={{ height }} />;
  if (!card) return chart;
  return <ChartCard title={title}>{chart}</ChartCard>;
}

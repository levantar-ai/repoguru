import ReactECharts from 'echarts-for-react';
import type { PatternsSection } from '@repoguru/core';
import { baseOption } from './echartsTheme.js';
import { ChartCard } from './ChartCard.js';

const SUN_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CommitsByWeekdayChartProps {
  /**
   * Per the canonical contract: length 7, Sun=0..Sat=6.
   * If your adapter emits Mon-first, rotate before passing in.
   */
  data: PatternsSection['commitsByWeekday'];
  /** Override the day labels (e.g. for non-English locales). */
  dayLabels?: readonly string[];
  /** Pixel height for the chart canvas. */
  height?: number;
  title?: string;
  /** Wrap the chart in a ChartCard. Set false when the host already
   *  supplies card chrome around the chart. */
  card?: boolean;
}

export function CommitsByWeekdayChart({
  data,
  dayLabels = SUN_FIRST,
  height = 250,
  title = 'Commits by Weekday',
  card = true,
}: CommitsByWeekdayChartProps) {
  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
    xAxis: {
      type: 'category',
      data: [...dayLabels],
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
        data: data.map((value, i) => ({
          value,
          // Weekend buckets get a different colour. With Sun-first that's
          // indices 0 and 6; with Mon-first the host should pass dayLabels
          // and accept that the colouring follows position, not weekday.
          itemStyle: { color: i === 0 || i === 6 ? '#a78bfa' : '#38bdf8' },
        })),
        barWidth: '60%',
      },
    ],
  });

  const chart = <ReactECharts option={option} style={{ height }} />;
  if (!card) return chart;
  return <ChartCard title={title}>{chart}</ChartCard>;
}

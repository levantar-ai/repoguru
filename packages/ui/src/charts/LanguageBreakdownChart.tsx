import ReactECharts from 'echarts-for-react';
import type { PatternsSection } from '@repoguru/core';
import { CHART_COLORS } from './echartsTheme.js';
import { ChartCard } from './ChartCard.js';

export interface LanguageBreakdownChartProps {
  /** Canonical languageBreakdown — `{ language, percentage, fileCount?, totalLines?, bytes? }[]`. */
  data: PatternsSection['languageBreakdown'];
  /** Cap the number of slices. Excess languages are dropped (not pooled). */
  topN?: number;
  height?: number;
  title?: string;
  /** Wrap the chart in a ChartCard. Set false when the host already
   *  supplies card chrome around the chart. */
  card?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function LanguageBreakdownChart({
  data,
  topN = 15,
  height = 300,
  title = 'Language Breakdown',
  card = true,
}: LanguageBreakdownChartProps) {
  const sorted = [...data].sort((a, b) => b.percentage - a.percentage).slice(0, topN);

  const option = {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: (params: { dataIndex: number }) => {
        const d = sorted[params.dataIndex];
        if (!d) return '';
        const lines = [`<b>${d.language}</b>`, `${d.percentage.toFixed(1)}%`];
        const counts: string[] = [];
        if (d.fileCount !== undefined) counts.push(`${d.fileCount} files`);
        if (d.totalLines !== undefined) counts.push(`${d.totalLines.toLocaleString()} lines`);
        if (counts.length > 0) lines.push(counts.join(' · '));
        if (d.bytes !== undefined) lines.push(formatBytes(d.bytes));
        return lines.join('<br/>');
      },
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['42%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        data: sorted.map((d, i) => ({
          name: d.language,
          value: d.percentage,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
        label: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (p: { name: string; percent: number }) => (p.percent > 3 ? p.name : ''),
        },
        labelLine: { lineStyle: { color: '#475569' } },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
        },
      },
    ],
  };

  const chart = <ReactECharts option={option} style={{ height }} />;
  if (!card) return chart;
  return <ChartCard title={title}>{chart}</ChartCard>;
}

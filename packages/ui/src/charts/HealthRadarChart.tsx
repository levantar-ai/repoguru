import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { HealthSection } from '@repoguru/core';
import { ChartCard } from './ChartCard.js';

export interface HealthRadarChartProps {
  /** Canonical radar metrics. The chart auto-detects 0..1 vs 0..100 ranges. */
  metrics: HealthSection['radarMetrics'];
  /**
   * Override the radar's per-axis maximum. Defaults to 100 if any value
   * exceeds 1 (the canonical 0..100 contract), otherwise 1 (matching the
   * legacy desktop wire shape that still emits 0..1).
   */
  max?: number;
  height?: number;
  title?: string;
  subtitle?: string;
  /** Wrap the chart in a ChartCard. Set false when the host already
   *  supplies card chrome around the chart. */
  card?: boolean;
}

export function HealthRadarChart({
  metrics,
  max,
  height = 320,
  title = 'Health Radar',
  subtitle = 'Multi-dimensional repository health',
  card = true,
}: HealthRadarChartProps) {
  const resolvedMax = max ?? (metrics.some((m) => m.value > 1) ? 100 : 1);

  const option: EChartsOption = {
    radar: {
      indicator: metrics.map((m) => ({ name: m.label, max: resolvedMax })),
      shape: 'polygon',
      splitNumber: 4,
      axisName: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#1e293b' } },
      splitArea: { areaStyle: { color: ['transparent', 'rgba(56,189,248,0.03)'] } },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: metrics.map((m) => m.value),
            name: title,
            areaStyle: { color: 'rgba(56,189,248,0.2)' },
            lineStyle: { color: '#38bdf8', width: 2 },
            itemStyle: { color: '#38bdf8' },
          },
        ],
      },
    ],
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
  };

  const chart = <ReactECharts option={option} style={{ height }} />;
  if (!card) return chart;
  return (
    <ChartCard title={title} subtitle={subtitle}>
      {chart}
    </ChartCard>
  );
}

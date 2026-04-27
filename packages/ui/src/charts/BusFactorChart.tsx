import ReactECharts from 'echarts-for-react';
import type { HealthSection } from '@repoguru/core';
import { baseOption } from './echartsTheme.js';
import { ChartCard } from './ChartCard.js';

export interface BusFactorChartProps {
  /** Canonical bus factor — `factor` plus the lorenz curve (0..1 cumulative shares). */
  busFactor: HealthSection['busFactor'];
  height?: number;
  title?: string;
  /** Wrap the chart in a ChartCard. Set false when the host already
   *  supplies card chrome around the chart. */
  card?: boolean;
}

export function BusFactorChart({
  busFactor,
  height = 300,
  title = 'Bus Factor',
  card = true,
}: BusFactorChartProps) {
  const { factor, lorenz } = busFactor;
  const n = lorenz.length;
  const labels = lorenz.map((_, i) => `${Math.round(((i + 1) / n) * 100)}%`);
  const equality = lorenz.map((_, i) => (i + 1) / n);

  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
    legend: { data: ['Actual', 'Perfect Equality'], textStyle: { color: '#94a3b8' }, bottom: 0 },
    grid: { top: 30, right: 20, bottom: 50, left: 50 },
    xAxis: {
      type: 'category',
      data: labels,
      name: 'Contributors',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b', fontSize: 10, interval: Math.max(0, Math.floor(n / 8) - 1) },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      max: 1,
      name: 'Cumulative Share',
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b', formatter: (v: number) => `${Math.round(v * 100)}%` },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Actual',
        type: 'line',
        data: [...lorenz],
        smooth: true,
        showSymbol: false,
        areaStyle: { color: 'rgba(167,139,250,0.15)' },
        lineStyle: { color: '#a78bfa', width: 2 },
      },
      {
        name: 'Perfect Equality',
        type: 'line',
        data: equality,
        lineStyle: { color: '#475569', type: 'dashed', width: 1 },
        showSymbol: false,
      },
    ],
  });

  const chart = <ReactECharts option={option} style={{ height }} />;
  if (!card) return chart;
  return (
    <ChartCard
      title={title}
      subtitle={`Factor: ${factor} — Lorenz curve of commit distribution`}
    >
      {chart}
    </ChartCard>
  );
}

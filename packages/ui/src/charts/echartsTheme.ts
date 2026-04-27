import type { EChartsOption } from 'echarts';

export const CHART_COLORS = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#facc15',
  '#22d3ee',
  '#c084fc',
  '#4ade80',
  '#fb7185',
];

/** Shared echarts defaults for every chart in @repoguru/ui. */
export function baseOption(overrides: EChartsOption = {}): EChartsOption {
  return {
    color: CHART_COLORS,
    textStyle: { color: '#94a3b8', fontFamily: 'inherit' },
    grid: { top: 40, right: 20, bottom: 40, left: 50, containLabel: true },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
    },
    legend: { textStyle: { color: '#94a3b8' } },
    xAxis: {
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    ...overrides,
  };
}

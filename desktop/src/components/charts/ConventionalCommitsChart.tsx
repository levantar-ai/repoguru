import ReactECharts from 'echarts-for-react';
import { CHART_COLORS } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: Record<string, number>;
}

const TYPE_COLORS: Record<string, string> = {
  feat: '#34d399',
  fix: '#f87171',
  docs: '#38bdf8',
  style: '#a78bfa',
  refactor: '#fb923c',
  perf: '#facc15',
  test: '#22d3ee',
  build: '#64748b',
  ci: '#c084fc',
  chore: '#94a3b8',
  revert: '#f472b6',
};

export function ConventionalCommitsChart({ data }: Props) {
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  const option = {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
    },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      data: entries.map(([type, count], i) => ({
        name: type,
        value: count,
        itemStyle: { color: TYPE_COLORS[type] ?? CHART_COLORS[i % CHART_COLORS.length] },
      })),
      label: { color: '#94a3b8', fontSize: 11 },
      labelLine: { lineStyle: { color: '#475569' } },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
  };

  return (
    <ChartCard title="Conventional Commits" subtitle="Commit type distribution">
      <ReactECharts option={option} style={{ height: 280 }} />
    </ChartCard>
  );
}

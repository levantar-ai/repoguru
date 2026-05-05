import ReactECharts from 'echarts-for-react';
import { baseOption } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Props {
  timeseries: Array<{ period_start: string; commits: number; insertions: number; deletions: number }>;
}

export function CodeFrequencyChart({ timeseries }: Props) {
  const option = baseOption({
    tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' } },
    legend: { data: ['Insertions', 'Deletions'], textStyle: { color: '#94a3b8' } },
    xAxis: {
      type: 'category',
      data: timeseries.map((d) => d.period_start),
      axisLabel: { color: '#64748b', fontSize: 10, rotate: 45 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        name: 'Insertions',
        type: 'bar',
        stack: 'lines',
        data: timeseries.map((d) => d.insertions),
        itemStyle: { color: '#34d399' },
      },
      {
        name: 'Deletions',
        type: 'bar',
        stack: 'lines',
        data: timeseries.map((d) => -d.deletions),
        itemStyle: { color: '#f87171' },
      },
    ],
  });

  return (
    <ChartCard title="Code Frequency" subtitle="Insertions & deletions over time">
      <ReactECharts option={option} style={{ height: 300 }} />
    </ChartCard>
  );
}

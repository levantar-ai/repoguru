import ReactECharts from 'echarts-for-react';
import { baseOption } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: Array<[string, number]>; // [date, cumulative_count]
}

export function RepoGrowthChart({ data }: Props) {
  const option = baseOption({
    tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' } },
    xAxis: {
      type: 'category',
      data: data.map((d) => d[0]),
      axisLabel: { color: '#64748b', fontSize: 10, rotate: 45 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{
      type: 'line',
      data: data.map((d) => d[1]),
      smooth: true,
      showSymbol: false,
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(34,211,238,0.25)' },
            { offset: 1, color: 'rgba(34,211,238,0)' },
          ],
        },
      },
      lineStyle: { color: '#22d3ee', width: 2 },
    }],
  });

  return (
    <ChartCard title="Repository Growth" subtitle="Cumulative unique files over time">
      <ReactECharts option={option} style={{ height: 280 }} />
    </ChartCard>
  );
}

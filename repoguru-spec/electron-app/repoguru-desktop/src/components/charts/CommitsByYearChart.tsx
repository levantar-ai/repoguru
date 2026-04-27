import ReactECharts from 'echarts-for-react';
import { baseOption } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: Record<string, number>;
}

export function CommitsByYearChart({ data }: Props) {
  const years = Object.keys(data).sort();
  const values = years.map((y) => data[y]);

  const option = baseOption({
    tooltip: { trigger: 'axis', backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' } },
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
    series: [{
      type: 'line',
      data: values,
      smooth: true,
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(56,189,248,0.3)' }, { offset: 1, color: 'rgba(56,189,248,0)' }] } },
      lineStyle: { color: '#38bdf8', width: 2 },
      itemStyle: { color: '#38bdf8' },
    }],
  });

  return (
    <ChartCard title="Commits by Year">
      <ReactECharts option={option} style={{ height: 250 }} />
    </ChartCard>
  );
}

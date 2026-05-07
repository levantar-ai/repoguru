import ReactECharts from 'echarts-for-react';
import { baseOption } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: Array<[string, number]>; // [bucket_label, count]
}

export function CommitSizeHistogram({ data }: Props) {
  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d[0]),
      axisLabel: { color: '#64748b', fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'log',
      min: 1,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d[1]),
        itemStyle: { color: '#fb923c', borderRadius: [3, 3, 0, 0] },
        barWidth: '60%',
      },
    ],
  });

  return (
    <ChartCard title="Commit Size Distribution" subtitle="Lines changed per commit (log scale)">
      <ReactECharts option={option} style={{ height: 250 }} />
    </ChartCard>
  );
}

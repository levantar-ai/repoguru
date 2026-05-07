import ReactECharts from 'echarts-for-react';
import { baseOption } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Props {
  data: Array<[number, number]>; // [offset_hours, count]
}

export function TimezoneChart({ data }: Props) {
  const sorted = data.slice().sort((a, b) => a[0] - b[0]);

  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
      formatter: (params: any) => {
        const p = params[0];
        const offset = sorted[p.dataIndex][0];
        const sign = offset >= 0 ? '+' : '';
        return `UTC${sign}${offset}<br/>Commits: <b>${p.value}</b>`;
      },
    },
    xAxis: {
      type: 'category',
      data: sorted.map((d) => {
        const sign = d[0] >= 0 ? '+' : '';
        return `UTC${sign}${d[0]}`;
      }),
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
        type: 'bar',
        data: sorted.map((d) => d[1]),
        itemStyle: { color: '#22d3ee', borderRadius: [3, 3, 0, 0] },
        barWidth: '70%',
      },
    ],
  });

  return (
    <ChartCard title="Timezone Distribution" subtitle="Contributor commit timezones">
      <ReactECharts option={option} style={{ height: 250 }} />
    </ChartCard>
  );
}

import ReactECharts from 'echarts-for-react';
import { baseOption } from './echarts-theme';
import { ChartCard } from './ChartCard';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

interface Props {
  punchCard: Array<[number, number, number]>; // [day, hour, count]
}

export function PunchCardChart({ punchCard }: Props) {
  const maxCount = Math.max(...punchCard.map((d) => d[2]), 1);

  const option = baseOption({
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
      formatter: (params: any) => {
        const d = params.data;
        return `${DAYS[d[1]]} ${HOURS[d[0]]}<br/>Commits: <b>${d[2]}</b>`;
      },
    },
    grid: { top: 20, right: 20, bottom: 40, left: 60 },
    xAxis: {
      type: 'category',
      data: HOURS,
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: DAYS,
      axisLabel: { color: '#64748b' },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: number[]) => Math.max(4, (val[2] / maxCount) * 28),
        data: punchCard.map(([day, hour, count]) => [hour, day, count]),
        itemStyle: { color: '#38bdf8', opacity: 0.8 },
      },
    ],
  });

  return (
    <ChartCard title="Punch Card" subtitle="Commit activity by day and hour">
      <ReactECharts option={option} style={{ height: 280 }} />
    </ChartCard>
  );
}

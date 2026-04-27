import ReactECharts from 'echarts-for-react';
import { baseOption } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Tag {
  name: string;
  date: string;
  commits_since_prev: number;
}

interface Props {
  tags: Tag[];
}

export function TagHistoryChart({ tags }: Props) {
  if (tags.length === 0) return null;

  const recent = tags.slice(-30);

  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
      formatter: (params: any) => {
        const p = params[0];
        const tag = recent[p.dataIndex];
        return `<b>${tag.name}</b><br/>${tag.date}<br/>Commits since prev: ${tag.commits_since_prev}`;
      },
    },
    grid: { top: 30, right: 20, bottom: 60, left: 50 },
    xAxis: {
      type: 'category',
      data: recent.map((t) => t.name),
      axisLabel: { color: '#64748b', fontSize: 9, rotate: 60, interval: 0 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'value',
      name: 'Commits',
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series: [{
      type: 'bar',
      data: recent.map((t) => t.commits_since_prev),
      itemStyle: { color: '#c084fc', borderRadius: [3, 3, 0, 0] },
      barWidth: '65%',
    }],
  });

  return (
    <ChartCard title="Release / Tag History" subtitle={`Last ${recent.length} tags`}>
      <ReactECharts option={option} style={{ height: 280 }} />
    </ChartCard>
  );
}

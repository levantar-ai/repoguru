import ReactECharts from 'echarts-for-react';
import { baseOption, CHART_COLORS } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface Author {
  author_id: number;
  commits: number;
  insertions: number;
  deletions: number;
}

interface Props {
  authors: Author[];
  authorNames: Record<string, string>;
}

export function ContributorChart({ authors, authorNames }: Props) {
  const top = authors
    .slice()
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 15);

  const getName = (id: number) => authorNames[String(id)] ?? `Author ${id}`;

  const option = baseOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' },
      formatter: (params: any) => {
        const p = params[0];
        const author = top[p.dataIndex];
        return `<b>${p.name}</b><br/>Commits: ${author.commits}<br/>+${author.insertions} / -${author.deletions}`;
      },
    },
    grid: { top: 20, right: 20, bottom: 10, left: 10, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'category',
      data: top.map((a) => getName(a.author_id)).reverse(),
      axisLabel: { color: '#94a3b8', fontSize: 11, width: 120, overflow: 'truncate' },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: top.map((a) => a.commits).reverse(),
        itemStyle: {
          color: (params: any) => CHART_COLORS[params.dataIndex % CHART_COLORS.length],
          borderRadius: [0, 3, 3, 0],
        },
        barWidth: '65%',
      },
    ],
  });

  return (
    <ChartCard title="Top Contributors" subtitle={`${authors.length} total contributors`}>
      <ReactECharts option={option} style={{ height: Math.max(280, top.length * 28) }} />
    </ChartCard>
  );
}

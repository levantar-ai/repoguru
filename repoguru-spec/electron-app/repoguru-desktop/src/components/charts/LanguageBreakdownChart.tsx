import ReactECharts from 'echarts-for-react';
import { CHART_COLORS } from './echarts-theme';
import { ChartCard } from './ChartCard';

interface LangEntry {
  language: string;
  percentage: number;
  file_count: number;
  total_lines: number;
}

interface Props {
  data: LangEntry[];
}

export function LanguageBreakdownChart({ data }: Props) {
  const sorted = data.slice().sort((a, b) => b.percentage - a.percentage);

  const option = {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9', fontSize: 12 },
      formatter: (params: any) => {
        const d = sorted[params.dataIndex];
        return `<b>${d.language}</b><br/>${d.percentage.toFixed(1)}%<br/>${d.file_count} files · ${d.total_lines.toLocaleString()} lines`;
      },
    },
    series: [{
      type: 'pie',
      radius: ['42%', '70%'],
      center: ['50%', '50%'],
      data: sorted.map((d, i) => ({
        name: d.language,
        value: d.percentage,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      })),
      label: {
        color: '#94a3b8',
        fontSize: 11,
        formatter: (p: any) => p.percent > 3 ? p.name : '',
      },
      labelLine: { lineStyle: { color: '#475569' } },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
      },
    }],
  };

  return (
    <ChartCard title="Language Breakdown">
      <ReactECharts option={option} style={{ height: 300 }} />
    </ChartCard>
  );
}

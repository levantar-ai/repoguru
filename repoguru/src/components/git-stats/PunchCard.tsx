import { useMemo } from 'react';
import type { PunchCardData } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  punchCard: PunchCardData[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return '12a';
  if (i < 12) return `${i}a`;
  if (i === 12) return '12p';
  return `${i - 12}p`;
});

export function PunchCard({ punchCard }: Props) {
  const option = useMemo(() => {
    if (!punchCard || punchCard.length === 0) return {};

    const maxCommits = Math.max(...punchCard.map((p) => p.commits), 1);

    const data = punchCard.map((p) => [p.hour, p.day, p.commits]);

    return {
      tooltip: {
        formatter: (params: { value: number[] }) => {
          const [hour, day, commits] = params.value;
          return `<b>${DAY_LABELS[day]} ${HOUR_LABELS[hour]}</b><br/>${commits} commit${commits !== 1 ? 's' : ''}`;
        },
      },
      grid: {
        left: 60,
        right: 20,
        top: 10,
        bottom: 30,
      },
      xAxis: {
        type: 'category' as const,
        data: HOUR_LABELS,
        axisLabel: { color: '#64748b', fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'category' as const,
        data: DAY_LABELS,
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'scatter',
          data,
          symbolSize: (val: number[]) => {
            return Math.max(4, (val[2] / maxCommits) * 30);
          },
          itemStyle: {
            color: (params: { value: number[] }) => {
              const ratio = params.value[2] / maxCommits;
              if (ratio === 0) return '#1e293b';
              if (ratio < 0.25) return '#0c4a6e';
              if (ratio < 0.5) return '#0284c7';
              if (ratio < 0.75) return '#38bdf8';
              return '#7dd3fc';
            },
          },
        },
      ],
    };
  }, [punchCard]);

  if (!punchCard || punchCard.length === 0) return null;

  return <EChartsWrapper option={option} height="280px" />;
}

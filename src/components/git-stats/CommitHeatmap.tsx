import { useMemo } from 'react';
import type { GitHubCommitActivity } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  commitActivity: GitHubCommitActivity[];
}

export function CommitHeatmap({ commitActivity }: Props) {
  const option = useMemo(() => {
    if (!commitActivity || commitActivity.length === 0) return {};

    // Build data: [date, value]
    const data: [string, number][] = [];
    for (const week of commitActivity) {
      const weekStart = new Date(week.week * 1000);
      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + d);
        const dateStr = date.toISOString().split('T')[0];
        data.push([dateStr, week.days[d]]);
      }
    }

    // Get the date range
    const dates = data.map((d) => d[0]).sort((a, b) => a.localeCompare(b));
    const rangeStart = dates[0];
    const rangeEnd = dates[dates.length - 1];

    const maxVal = Math.max(...data.map((d) => d[1]), 1);

    return {
      tooltip: {
        formatter: (params: { value: [string, number] }) => {
          const [date, val] = params.value;
          return `<b>${date}</b><br/>${val} commit${val !== 1 ? 's' : ''}`;
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        type: 'piecewise' as const,
        orient: 'horizontal' as const,
        left: 'center',
        bottom: 0,
        pieces: [
          { min: 0, max: 0, color: '#1e293b', label: '0' },
          { min: 1, max: Math.ceil(maxVal * 0.25), color: '#0c4a6e', label: 'Low' },
          {
            min: Math.ceil(maxVal * 0.25) + 1,
            max: Math.ceil(maxVal * 0.5),
            color: '#0284c7',
            label: 'Med',
          },
          {
            min: Math.ceil(maxVal * 0.5) + 1,
            max: Math.ceil(maxVal * 0.75),
            color: '#38bdf8',
            label: 'High',
          },
          { min: Math.ceil(maxVal * 0.75) + 1, max: maxVal, color: '#7dd3fc', label: 'Max' },
        ],
        textStyle: { color: '#64748b', fontSize: 10 },
      },
      calendar: {
        top: 30,
        left: 50,
        right: 30,
        bottom: 50,
        cellSize: ['auto', 14],
        range: [rangeStart, rangeEnd],
        splitLine: { lineStyle: { color: '#0f172a', width: 2 } },
        itemStyle: {
          borderColor: '#0f172a',
          borderWidth: 2,
          color: '#1e293b',
        },
        dayLabel: {
          color: '#64748b',
          fontSize: 10,
          nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
        },
        monthLabel: {
          color: '#94a3b8',
          fontSize: 11,
        },
        yearLabel: { show: false },
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data,
        },
      ],
    };
  }, [commitActivity]);

  if (!commitActivity || commitActivity.length === 0) {
    return null;
  }

  return <EChartsWrapper option={option} height="200px" />;
}

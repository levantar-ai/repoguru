import { useMemo } from 'react';
import type { RepoGrowthPoint } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  repoGrowth: RepoGrowthPoint[];
}

export function RepoGrowthTimeline({ repoGrowth }: Props) {
  const option = useMemo(() => {
    if (repoGrowth.length === 0) return {};

    const dates = repoGrowth.map((p) => p.date);
    const additions = repoGrowth.map((p) => p.cumulativeAdditions);
    const deletions = repoGrowth.map((p) => p.cumulativeDeletions);
    const netGrowth = repoGrowth.map((p) => p.netGrowth);

    return {
      tooltip: {
        trigger: 'axis' as const,
        formatter: (
          params: Array<{ seriesName: string; value: number; axisValueLabel: string }>,
        ) => {
          let html = `<b>${params[0].axisValueLabel}</b>`;
          for (const p of params) {
            let val: string;
            if (p.value >= 1000000) {
              val = `${(p.value / 1000000).toFixed(1)}M`;
            } else if (p.value >= 1000) {
              val = `${(p.value / 1000).toFixed(0)}K`;
            } else {
              val = p.value.toLocaleString();
            }
            html += `<br/>${p.seriesName}: ${val}`;
          }
          return html;
        },
      },
      legend: {
        data: ['Additions', 'Deletions', 'Net Growth'],
        top: 0,
      },
      grid: {
        left: 70,
        right: 30,
        top: 40,
        bottom: 80,
      },
      xAxis: {
        type: 'category' as const,
        data: dates,
        axisLabel: {
          rotate: 45,
          fontSize: 10,
          color: '#64748b',
          formatter: (val: string) => val.slice(0, 7),
        },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          color: '#64748b',
          formatter: (val: number) => {
            if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
            if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}K`;
            return val.toString();
          },
        },
      },
      dataZoom: [
        { type: 'inside' as const, start: 0, end: 100 },
        {
          type: 'slider' as const,
          start: 0,
          end: 100,
          bottom: 10,
          height: 24,
          borderColor: '#334155',
          backgroundColor: '#1e293b',
          fillerColor: 'rgba(56, 189, 248, 0.1)',
          handleStyle: { color: '#38bdf8' },
          textStyle: { color: '#64748b' },
        },
      ],
      series: [
        {
          name: 'Additions',
          type: 'line',
          areaStyle: { color: 'rgba(52, 211, 153, 0.08)' },
          lineStyle: { color: '#34d399', width: 1 },
          itemStyle: { color: '#34d399' },
          data: additions,
          smooth: true,
          symbol: 'none',
        },
        {
          name: 'Deletions',
          type: 'line',
          areaStyle: { color: 'rgba(248, 113, 113, 0.08)' },
          lineStyle: { color: '#f87171', width: 1 },
          itemStyle: { color: '#f87171' },
          data: deletions,
          smooth: true,
          symbol: 'none',
        },
        {
          name: 'Net Growth',
          type: 'line',
          lineStyle: { color: '#38bdf8', width: 2 },
          itemStyle: { color: '#38bdf8' },
          data: netGrowth,
          smooth: true,
          symbol: 'none',
        },
      ],
    };
  }, [repoGrowth]);

  if (repoGrowth.length === 0) return null;

  return <EChartsWrapper option={option} height="350px" />;
}

import { useMemo } from 'react';
import type { GitHubCodeFrequency } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  codeFrequency: GitHubCodeFrequency[];
}

export function CodeFrequencyChart({ codeFrequency }: Props) {
  const option = useMemo(() => {
    if (!codeFrequency || codeFrequency.length === 0) return {};

    const dates = codeFrequency.map(([ts]) => new Date(ts * 1000).toISOString().split('T')[0]);
    const additions = codeFrequency.map(([, a]) => a);
    const deletions = codeFrequency.map(([, , d]) => Math.abs(d));

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'cross' as const },
      },
      legend: {
        data: ['Additions', 'Deletions'],
        top: 0,
      },
      grid: {
        left: 60,
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
            if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
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
          stack: 'total',
          areaStyle: { color: 'rgba(52, 211, 153, 0.15)' },
          lineStyle: { color: '#34d399', width: 1.5 },
          itemStyle: { color: '#34d399' },
          data: additions,
          smooth: true,
          symbol: 'none',
        },
        {
          name: 'Deletions',
          type: 'line',
          stack: 'total',
          areaStyle: { color: 'rgba(248, 113, 113, 0.15)' },
          lineStyle: { color: '#f87171', width: 1.5 },
          itemStyle: { color: '#f87171' },
          data: deletions.map((d) => -d),
          smooth: true,
          symbol: 'none',
        },
      ],
    };
  }, [codeFrequency]);

  if (!codeFrequency || codeFrequency.length === 0) return null;

  return <EChartsWrapper option={option} height="350px" />;
}

import { useMemo } from 'react';
import type { HotspotEntry } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  readonly hotspots: HotspotEntry[];
}

export function HotspotBubble({ hotspots }: Props) {
  const option = useMemo(() => {
    const maxChurn = Math.max(...hotspots.map((h) => h.totalChurn), 1);

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { data: number[]; name: string }) => {
          const [commits, authors, churn] = params.data;
          return [
            `<strong>${params.name}</strong>`,
            `Commits: ${commits}`,
            `Authors: ${authors}`,
            `Churn: ${churn.toLocaleString()}`,
          ].join('<br/>');
        },
      },
      xAxis: {
        name: 'Commits',
        nameLocation: 'center',
        nameGap: 30,
        type: 'value',
      },
      yAxis: {
        name: 'Distinct Authors',
        nameLocation: 'center',
        nameGap: 40,
        type: 'value',
      },
      grid: {
        left: 60,
        right: 30,
        top: 20,
        bottom: 50,
      },
      series: [
        {
          type: 'scatter',
          data: hotspots.map((h) => ({
            name: h.path,
            value: [h.commits, h.distinctAuthors, h.totalChurn],
            symbolSize: Math.max(8, (h.totalChurn / maxChurn) * 60),
          })),
          emphasis: {
            focus: 'self',
          },
          itemStyle: {
            opacity: 0.7,
          },
        },
      ],
    };
  }, [hotspots]);

  if (hotspots.length === 0) return null;

  return <EChartsWrapper option={option} height="450px" />;
}

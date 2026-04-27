import { useMemo } from 'react';
import type { HotspotEntry } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  readonly hotspots: HotspotEntry[];
}

export function HotspotTreemap({ hotspots }: Props) {
  const option = useMemo(() => {
    const maxAuthors = Math.max(...hotspots.map((h) => h.distinctAuthors), 1);

    return {
      tooltip: {
        formatter: (params: { name: string; value: number; data: { authors: number } }) => {
          return [
            `<strong>${params.name}</strong>`,
            `Churn: ${params.value.toLocaleString()}`,
            `Authors: ${params.data.authors}`,
          ].join('<br/>');
        },
      },
      visualMap: {
        type: 'continuous',
        min: 1,
        max: maxAuthors,
        dimension: 0,
        inRange: {
          color: ['#2d5a27', '#a3e635', '#facc15', '#f97316', '#ef4444'],
        },
        text: ['Many Authors', 'Few'],
        textStyle: {
          color: '#94a3b8',
        },
        show: true,
        right: 10,
        bottom: 10,
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          width: '100%',
          height: '100%',
          data: hotspots.map((h) => ({
            name: h.path,
            value: h.totalChurn,
            authors: h.distinctAuthors,
            itemStyle: {
              color: undefined,
            },
            visualMap: false,
          })),
          label: {
            show: true,
            formatter: '{b}',
            fontSize: 11,
            color: '#e2e8f0',
          },
          breadcrumb: {
            show: false,
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#1e293b',
                borderWidth: 2,
                gapWidth: 2,
              },
              colorMappingBy: 'value',
            },
          ],
          itemStyle: {
            borderColor: '#1e293b',
            borderWidth: 1,
          },
        },
      ],
    };
  }, [hotspots]);

  if (hotspots.length === 0) return null;

  return <EChartsWrapper option={option} height="450px" />;
}

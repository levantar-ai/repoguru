import { useMemo } from 'react';
import type { OwnershipEntry } from '../../types/gitStats';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  readonly codeOwnership: OwnershipEntry[];
}

const OWNER_COLORS = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#fb923c',
  '#2dd4bf',
  '#e879f9',
  '#38bdf8',
  '#4ade80',
  '#facc15',
  '#f472b6',
  '#818cf8',
  '#22d3ee',
  '#a3e635',
];

export function CodeOwnership({ codeOwnership }: Props) {
  const option = useMemo(() => {
    // Group entries by ownerName
    const ownerMap = new Map<string, OwnershipEntry[]>();
    for (const entry of codeOwnership) {
      const list = ownerMap.get(entry.ownerName) ?? [];
      list.push(entry);
      ownerMap.set(entry.ownerName, list);
    }

    const owners = Array.from(ownerMap.keys());

    const data = owners.map((owner, i) => {
      const entries = ownerMap.get(owner)!;
      return {
        name: owner,
        itemStyle: {
          color: OWNER_COLORS[i % OWNER_COLORS.length],
        },
        children: entries.map((e) => ({
          name: e.path,
          value: e.lines,
        })),
      };
    });

    return {
      tooltip: {
        formatter: (params: { name: string; value: number; treePathInfo: { name: string }[] }) => {
          const owner = params.treePathInfo.length > 1 ? params.treePathInfo[1].name : '';
          return [
            `<strong>${params.name}</strong>`,
            `Owner: ${owner}`,
            `Lines: ${params.value.toLocaleString()}`,
          ].join('<br/>');
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          width: '100%',
          height: '100%',
          data,
          label: {
            show: true,
            formatter: '{b}',
            fontSize: 11,
            color: '#e2e8f0',
          },
          upperLabel: {
            show: true,
            height: 24,
            fontSize: 12,
            color: '#e2e8f0',
            fontWeight: 'bold',
          },
          breadcrumb: {
            show: false,
          },
          levels: [
            {
              itemStyle: {
                borderColor: '#1e293b',
                borderWidth: 3,
                gapWidth: 3,
              },
            },
            {
              itemStyle: {
                borderColor: '#334155',
                borderWidth: 1,
                gapWidth: 1,
              },
              colorSaturation: [0.3, 0.7],
              colorMappingBy: 'value',
            },
          ],
        },
      ],
    };
  }, [codeOwnership]);

  if (codeOwnership.length === 0) return null;

  return <EChartsWrapper option={option} height="450px" />;
}

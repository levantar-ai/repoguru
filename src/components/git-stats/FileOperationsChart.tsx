import { useMemo } from 'react';
import { EChartsWrapper } from './EChartsWrapper';

interface Props {
  fileOperations: { operation: string; count: number }[];
}

const OPERATION_COLORS: Record<string, string> = {
  added: '#34d399',
  modified: '#38bdf8',
  deleted: '#f87171',
  renamed: '#facc15',
  copied: '#a78bfa',
};

const DEFAULT_COLORS = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#facc15',
  '#22d3ee',
  '#818cf8',
  '#4ade80',
  '#f87171',
];

export function FileOperationsChart({ fileOperations }: Props) {
  const option = useMemo(
    () => ({
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}<br/>Count: <b>${params.value.toLocaleString()}</b> (${params.percent}%)`,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#1e293b', borderWidth: 2 },
          label: { color: '#94a3b8', fontSize: 12 },
          data: fileOperations.map((d, i) => ({
            name: d.operation,
            value: d.count,
            itemStyle: {
              color:
                OPERATION_COLORS[d.operation.toLowerCase()] ||
                DEFAULT_COLORS[i % DEFAULT_COLORS.length],
            },
          })),
        },
      ],
    }),
    [fileOperations],
  );

  if (fileOperations.length === 0) return null;
  return <EChartsWrapper option={option} height="300px" />;
}

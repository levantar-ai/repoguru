import { useState, useMemo } from 'react';
import type { LinesStatsSummary } from '../../types/gitStats';

interface Props {
  readonly linesStatsSummary: LinesStatsSummary[];
}

type SortKey = 'label' | 'min' | 'max' | 'avg' | 'median' | 'total';

function SortIcon({ active, dir }: Readonly<{ active: boolean; dir: 'asc' | 'desc' }>) {
  if (!active) return null;
  return (
    <svg
      className="h-3 w-3 text-neon ml-1 inline"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {dir === 'desc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      )}
    </svg>
  );
}

export function LinesStatsTable({ linesStatsSummary }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('label');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const items = [...linesStatsSummary];
    items.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [linesStatsSummary, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (linesStatsSummary.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
              onClick={() => toggleSort('label')}
            >
              Label <SortIcon active={sortKey === 'label'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24"
              onClick={() => toggleSort('min')}
            >
              Min <SortIcon active={sortKey === 'min'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24"
              onClick={() => toggleSort('max')}
            >
              Max <SortIcon active={sortKey === 'max'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24"
              onClick={() => toggleSort('avg')}
            >
              Avg <SortIcon active={sortKey === 'avg'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24"
              onClick={() => toggleSort('median')}
            >
              Median <SortIcon active={sortKey === 'median'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-28"
              onClick={() => toggleSort('total')}
            >
              Total <SortIcon active={sortKey === 'total'} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr
              key={entry.label}
              className="border-b border-border/50 hover:bg-surface-hover transition-colors"
            >
              <td className="py-2.5 px-3 text-text font-medium">{entry.label}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-muted">
                {entry.min.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-muted">
                {entry.max.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-neon font-semibold">
                {entry.avg.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">
                {entry.median.toLocaleString()}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text font-semibold">
                {entry.total.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

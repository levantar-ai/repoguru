import { useState, useMemo } from 'react';
import type { ChangeChain } from '../../types/gitStats';

interface Props {
  readonly sequentialCoupling: ChangeChain[];
}

type SortKey = 'files' | 'occurrences' | 'avgSpanHours' | 'confidence';

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

export function SequentialCouplingTable({ sequentialCoupling }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('occurrences');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const items = [...sequentialCoupling];
    items.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case 'files':
          av = a.files.join(', ');
          bv = b.files.join(', ');
          break;
        case 'occurrences':
          av = a.occurrences;
          bv = b.occurrences;
          break;
        case 'avgSpanHours':
          av = a.avgSpanHours;
          bv = b.avgSpanHours;
          break;
        case 'confidence':
          av = a.confidence;
          bv = b.confidence;
          break;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [sequentialCoupling, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (sequentialCoupling.length === 0) return null;

  const maxOccurrences = Math.max(...sequentialCoupling.map((e) => e.occurrences), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
              onClick={() => toggleSort('files')}
            >
              File(s) <SortIcon active={sortKey === 'files'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-28"
              onClick={() => toggleSort('occurrences')}
            >
              Occurrences <SortIcon active={sortKey === 'occurrences'} dir={sortDir} />
            </th>
            <th className="text-left py-3 px-3 w-40 hidden sm:table-cell" />
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-28 hidden md:table-cell"
              onClick={() => toggleSort('avgSpanHours')}
            >
              Avg Span (hrs) <SortIcon active={sortKey === 'avgSpanHours'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-28 hidden md:table-cell"
              onClick={() => toggleSort('confidence')}
            >
              Confidence <SortIcon active={sortKey === 'confidence'} dir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => (
            <tr
              key={i}
              className="border-b border-border/50 hover:bg-surface-hover transition-colors"
            >
              <td className="py-2.5 px-3">
                <div className="flex flex-col gap-0.5">
                  {entry.files.map((file) => (
                    <span
                      key={file}
                      className="font-mono text-xs text-text truncate max-w-[400px] block"
                      title={file}
                    >
                      {file}
                    </span>
                  ))}
                </div>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-neon font-semibold">
                {entry.occurrences}
              </td>
              <td className="py-2.5 px-3 hidden sm:table-cell">
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon/40 rounded-full"
                    style={{ width: `${(entry.occurrences / maxOccurrences) * 100}%` }}
                  />
                </div>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-muted text-xs hidden md:table-cell">
                {entry.avgSpanHours.toFixed(1)}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary text-xs hidden md:table-cell">
                {(entry.confidence * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

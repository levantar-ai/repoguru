import { useState, useMemo } from 'react';

interface FileCouplingEntry {
  file1: string;
  file2: string;
  cochanges: number;
}

interface Props {
  fileCoupling: FileCouplingEntry[];
}

type SortKey = 'file1' | 'file2' | 'cochanges';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
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

export function FileCoupling({ fileCoupling }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('cochanges');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const items = [...fileCoupling];
    items.sort((a, b) => {
      const av = sortKey === 'cochanges' ? a.cochanges : a[sortKey];
      const bv = sortKey === 'cochanges' ? b.cochanges : b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [fileCoupling, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (fileCoupling.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-8">
        No file coupling detected. Files need at least 3 co-changes to appear here.
      </p>
    );
  }

  const maxCochanges = Math.max(...fileCoupling.map((f) => f.cochanges), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th
              className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
              onClick={() => toggleSort('file1')}
            >
              File A <SortIcon active={sortKey === 'file1'} dir={sortDir} />
            </th>
            <th
              className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
              onClick={() => toggleSort('file2')}
            >
              File B <SortIcon active={sortKey === 'file2'} dir={sortDir} />
            </th>
            <th
              className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-28"
              onClick={() => toggleSort('cochanges')}
            >
              Co-changes <SortIcon active={sortKey === 'cochanges'} dir={sortDir} />
            </th>
            <th className="text-left py-3 px-3 w-40 hidden sm:table-cell" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => (
            <tr
              key={`${entry.file1}|||${entry.file2}`}
              className="border-b border-border/50 hover:bg-surface-hover transition-colors"
            >
              <td
                className="py-2.5 px-3 font-mono text-xs text-text truncate max-w-[300px]"
                title={entry.file1}
              >
                {entry.file1}
              </td>
              <td
                className="py-2.5 px-3 font-mono text-xs text-text truncate max-w-[300px]"
                title={entry.file2}
              >
                {entry.file2}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-neon font-semibold">
                {entry.cochanges}
              </td>
              <td className="py-2.5 px-3 hidden sm:table-cell">
                <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neon/40 rounded-full"
                    style={{ width: `${(entry.cochanges / maxCochanges) * 100}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

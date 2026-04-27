import { useState, useMemo } from 'react';
import type { FileChurnEntry } from '../../types/gitStats';

interface Props {
  readonly fileChurn: FileChurnEntry[];
}

type SortKey = 'filename' | 'changeCount' | 'additions' | 'deletions' | 'contributors';

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

export function FileChurnTable({ fileChurn }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('changeCount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showCount, setShowCount] = useState(25);

  const sorted = useMemo(() => {
    const items = [...fileChurn];
    items.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case 'filename':
          av = a.filename;
          bv = b.filename;
          break;
        case 'changeCount':
          av = a.changeCount;
          bv = b.changeCount;
          break;
        case 'additions':
          av = a.totalAdditions;
          bv = b.totalAdditions;
          break;
        case 'deletions':
          av = a.totalDeletions;
          bv = b.totalDeletions;
          break;
        case 'contributors':
          av = a.contributors.length;
          bv = b.contributors.length;
          break;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [fileChurn, sortKey, sortDir]);

  const visible = sorted.slice(0, showCount);
  const maxChanges = Math.max(...fileChurn.map((f) => f.changeCount), 1);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (fileChurn.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-8">
        No file churn data. Commit details require a GitHub token.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th
                className="text-left py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors"
                onClick={() => toggleSort('filename')}
              >
                File <SortIcon active={sortKey === 'filename'} dir={sortDir} />
              </th>
              <th
                className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-24"
                onClick={() => toggleSort('changeCount')}
              >
                Changes <SortIcon active={sortKey === 'changeCount'} dir={sortDir} />
              </th>
              <th className="text-left py-3 px-3 w-48 hidden sm:table-cell" />
              <th
                className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-20 hidden md:table-cell"
                onClick={() => toggleSort('additions')}
              >
                +Lines <SortIcon active={sortKey === 'additions'} dir={sortDir} />
              </th>
              <th
                className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-20 hidden md:table-cell"
                onClick={() => toggleSort('deletions')}
              >
                -Lines <SortIcon active={sortKey === 'deletions'} dir={sortDir} />
              </th>
              <th
                className="text-right py-3 px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-neon transition-colors w-20 hidden lg:table-cell"
                onClick={() => toggleSort('contributors')}
              >
                Authors <SortIcon active={sortKey === 'contributors'} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((file) => (
              <tr
                key={file.filename}
                className="border-b border-border/50 hover:bg-surface-hover transition-colors"
              >
                <td
                  className="py-2.5 px-3 font-mono text-xs text-text truncate max-w-[400px]"
                  title={file.filename}
                >
                  {file.filename}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-neon font-semibold">
                  {file.changeCount}
                </td>
                <td className="py-2.5 px-3 hidden sm:table-cell">
                  <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neon/40 rounded-full"
                      style={{ width: `${(file.changeCount / maxChanges) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-grade-a text-xs hidden md:table-cell">
                  +{file.totalAdditions.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-grade-f text-xs hidden md:table-cell">
                  -{file.totalDeletions.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-text-muted text-xs hidden lg:table-cell">
                  {file.contributors.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > showCount && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowCount((c) => c + 25)}
            className="text-sm text-neon hover:text-neon/80 transition-colors"
          >
            Show more ({sorted.length - showCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

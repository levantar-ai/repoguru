import { ChartCard } from './ChartCard';

interface CouplingEntry {
  file_a: string;
  file_b: string;
  count: number;
  coupling_pct: number;
}

interface Props {
  coupling: CouplingEntry[];
}

export function FileCouplingTable({ coupling }: Props) {
  const top = coupling.slice(0, 30);

  return (
    <ChartCard title="File Coupling" subtitle="Files frequently changed together" className="col-span-full">
      <div className="overflow-y-auto max-h-[400px]">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
              <th className="text-left py-2 font-medium">File A</th>
              <th className="text-left py-2 font-medium">File B</th>
              <th className="text-right py-2 font-medium w-20">Co-changes</th>
              <th className="text-right py-2 font-medium w-20">Coupling %</th>
            </tr>
          </thead>
          <tbody>
            {top.map((c, i) => (
              <tr key={i} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors">
                <td className="py-1.5 text-[var(--color-text-secondary)] font-mono truncate max-w-[250px]" title={c.file_a}>
                  {c.file_a}
                </td>
                <td className="py-1.5 text-[var(--color-text-secondary)] font-mono truncate max-w-[250px]" title={c.file_b}>
                  {c.file_b}
                </td>
                <td className="text-right py-1.5 text-[var(--color-text)]">{c.count}</td>
                <td className="text-right py-1.5">
                  <span className={`${c.coupling_pct >= 80 ? 'text-red-400' : c.coupling_pct >= 50 ? 'text-yellow-400' : 'text-[var(--color-text)]'}`}>
                    {c.coupling_pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

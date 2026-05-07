import type { RepoSizerStats } from '../charts/legacyTypes.js';

export interface RepoSizerPanelProps {
  sizer: RepoSizerStats;
}

/** git-sizer-style repo health stats — desktop-only because they
 *  require a full-history walk over every git object. The CLI's
 *  `metrics::sizer` produces 25 distinct metrics; this panel surfaces
 *  every one of them grouped into five intuitive sections:
 *
 *  - Object counts (blobs / trees / commits / tags + total bytes)
 *  - History shape (merges, max parents, depth, age)
 *  - Working tree at HEAD (files / dirs / size / symlinks / submodules)
 *  - Refs (total / branches / tag refs)
 *  - Extremes (deepest path, longest name, largest directory, largest
 *    objects)
 *
 *  Mirrors the layout of github/git-sizer's stdout report: clear
 *  metric → value → note rows so a reviewer can at-a-glance spot
 *  outliers (huge blobs, deep trees, runaway tag depth, etc.). */
export function RepoSizerPanel({ sizer }: RepoSizerPanelProps) {
  const ageDays =
    sizer.oldestCommit && sizer.newestCommit
      ? Math.max(1, Math.round((sizer.newestCommit - sizer.oldestCommit) / 86400))
      : 0;

  return (
    <div className="space-y-6">
      <Section title="Object counts">
        <Grid>
          <Stat label="Commits" value={fmtCount(sizer.objectCounts.commit)} />
          <Stat label="Trees" value={fmtCount(sizer.objectCounts.tree)} />
          <Stat label="Blobs" value={fmtCount(sizer.objectCounts.blob)} />
          <Stat label="Tags" value={fmtCount(sizer.objectCounts.tag)} />
          <Stat label="Total tree entries" value={fmtCount(sizer.totalTreeEntries)} />
          <Stat
            label="Storage (objects)"
            value={fmtBytes(
              sizer.totalBytes.blob +
                sizer.totalBytes.tree +
                sizer.totalBytes.commit +
                sizer.totalBytes.tag,
            )}
          />
          <Stat label="Blob bytes" value={fmtBytes(sizer.totalBytes.blob)} />
          <Stat label="Tree bytes" value={fmtBytes(sizer.totalBytes.tree)} />
        </Grid>
      </Section>

      <Section title="History shape">
        <Grid>
          <Stat label="Merge commits" value={fmtCount(sizer.mergeCount)} />
          <Stat
            label="Max parents (octopus)"
            value={fmtCount(sizer.maxParents)}
            warn={sizer.maxParents > 4}
          />
          <Stat label="Longest ancestor chain" value={fmtCount(sizer.maxHistoryDepth)} />
          <Stat
            label="Max tag-of-tag depth"
            value={fmtCount(sizer.maxTagDepth)}
            warn={sizer.maxTagDepth > 1}
          />
          <Stat
            label="Oldest commit"
            value={
              sizer.oldestCommit
                ? new Date(sizer.oldestCommit * 1000).toISOString().slice(0, 10)
                : '—'
            }
          />
          <Stat
            label="Newest commit"
            value={
              sizer.newestCommit
                ? new Date(sizer.newestCommit * 1000).toISOString().slice(0, 10)
                : '—'
            }
          />
          <Stat label="Repo age" value={ageDays > 0 ? `${ageDays.toLocaleString()} days` : '—'} />
        </Grid>
      </Section>

      <Section title="Working tree (HEAD)">
        <Grid>
          <Stat label="Files" value={fmtCount(sizer.checkout.files)} />
          <Stat label="Directories" value={fmtCount(sizer.checkout.dirs)} />
          <Stat label="Total size" value={fmtBytes(sizer.checkout.totalSize)} />
          <Stat label="Symlinks" value={fmtCount(sizer.checkout.symlinks)} />
          <Stat
            label="Submodules"
            value={fmtCount(sizer.checkout.submodules)}
            warn={sizer.checkout.submodules > 0}
          />
        </Grid>
      </Section>

      <Section title="References">
        <Grid>
          <Stat label="Total refs" value={fmtCount(sizer.refs.total)} />
          <Stat label="Branches" value={fmtCount(sizer.refs.branches)} />
          <Stat label="Tag refs" value={fmtCount(sizer.refs.tagRefs)} />
        </Grid>
      </Section>

      <Section title="Extremes">
        <div className="space-y-2 text-sm">
          <ExtremeRow
            label="Deepest path"
            value={sizer.deepestPath.path}
            metric={`${sizer.deepestPath.depth} levels`}
            warn={sizer.deepestPath.depth > 10}
          />
          <ExtremeRow
            label="Longest path (bytes)"
            value={sizer.longestPath.path}
            metric={`${sizer.longestPath.length}`}
            warn={sizer.longestPath.length > 200}
          />
          <ExtremeRow
            label="Longest single name"
            value={sizer.longestName.name}
            metric={`${sizer.longestName.length}`}
            warn={sizer.longestName.length > 100}
          />
          <ExtremeRow
            label="Largest directory"
            value={sizer.largestDirectory.path}
            metric={`${sizer.largestDirectory.entries.toLocaleString()} entries`}
            warn={sizer.largestDirectory.entries > 1000}
          />
          <ExtremeRow
            label="Largest commit object"
            value={shortOid(sizer.largestCommit.oid)}
            metric={fmtBytes(sizer.largestCommit.bytes)}
          />
        </div>
      </Section>

      {sizer.largestBlobs.length > 0 && (
        <Section title={`Largest blobs (top ${sizer.largestBlobs.length})`}>
          <ObjectTable
            rows={sizer.largestBlobs.map((b) => ({
              oid: b.oid,
              value: fmtBytes(b.size),
            }))}
            valueLabel="Size"
          />
        </Section>
      )}
      {sizer.largestTrees.length > 0 && (
        <Section title={`Largest trees (top ${sizer.largestTrees.length})`}>
          <ObjectTable
            rows={sizer.largestTrees.map((t) => ({
              oid: t.oid,
              value: `${t.entries.toLocaleString()} entries`,
            }))}
            valueLabel="Entries"
          />
        </Section>
      )}
    </div>
  );
}

// ───────────────────────── Primitives ─────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-alt p-6">
      <h3 className="text-base font-semibold text-text mb-4">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>;
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        warn ? 'border-grade-c/30 bg-grade-c/5' : 'border-border bg-surface'
      }`}
    >
      <div
        className={`text-xs ${warn ? 'text-grade-c' : 'text-text-muted'} uppercase tracking-wider`}
      >
        {label}
      </div>
      <div
        className={`text-base font-semibold tabular-nums ${warn ? 'text-grade-c' : 'text-text'} mt-0.5`}
      >
        {value}
      </div>
    </div>
  );
}

function ExtremeRow({
  label,
  value,
  metric,
  warn = false,
}: {
  label: string;
  value: string;
  metric: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2 rounded-md bg-surface border border-border">
      <div className="min-w-0 flex-1">
        <div
          className={`text-xs ${warn ? 'text-grade-c' : 'text-text-muted'} uppercase tracking-wider`}
        >
          {label}
        </div>
        <div className="text-sm text-text font-mono truncate" title={value}>
          {value || '—'}
        </div>
      </div>
      <div
        className={`text-sm font-semibold tabular-nums shrink-0 ${warn ? 'text-grade-c' : 'text-text'}`}
      >
        {metric}
      </div>
    </div>
  );
}

function ObjectTable({
  rows,
  valueLabel,
}: {
  rows: Array<{ oid: string; value: string }>;
  valueLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface text-text-muted text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left px-3 py-2 font-medium">#</th>
            <th className="text-left px-3 py-2 font-medium">Object ID</th>
            <th className="text-right px-3 py-2 font-medium">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.oid + i} className="border-t border-border">
              <td className="px-3 py-1.5 text-text-muted tabular-nums">{i + 1}</td>
              <td className="px-3 py-1.5 font-mono text-text">{shortOid(r.oid)}</td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-text">
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────── Formatting helpers ─────────────────────

function fmtCount(n: number): string {
  return (n ?? 0).toLocaleString();
}

function fmtBytes(n: number): string {
  if (!n || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(2) : v < 100 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function shortOid(oid: string): string {
  return oid ? oid.slice(0, 12) : '—';
}

import git, { type ReadCommitResult, type WalkerEntry, type FsClient } from 'isomorphic-git';
import type {
  GitHubCommitResponse,
  GitHubCommitDetailResponse,
  GitHubContributorStats,
  GitHubContributorStatsWeek,
  GitHubCodeFrequency,
  GitHubCommitActivity,
  GitHubPunchCard,
  GitHubLanguages,
} from '../../types/gitStats';

// ── Extension → Language map ──

const EXT_LANG: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  py: 'Python',
  pyw: 'Python',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin',
  swift: 'Swift',
  rb: 'Ruby',
  php: 'PHP',
  cs: 'C#',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  hpp: 'C++',
  c: 'C',
  h: 'C',
  scala: 'Scala',
  hs: 'Haskell',
  ex: 'Elixir',
  exs: 'Elixir',
  erl: 'Erlang',
  clj: 'Clojure',
  cljs: 'Clojure',
  dart: 'Dart',
  lua: 'Lua',
  r: 'R',
  m: 'Objective-C',
  mm: 'Objective-C',
  pl: 'Perl',
  pm: 'Perl',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'CSS',
  sass: 'CSS',
  less: 'CSS',
  vue: 'Vue',
  svelte: 'Svelte',
  sql: 'SQL',
  md: 'Markdown',
  mdx: 'Markdown',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  xml: 'XML',
  toml: 'TOML',
  zig: 'Zig',
  nim: 'Nim',
  v: 'V',
  jl: 'Julia',
};

// ── Convert git.log() entries to GitHubCommitResponse[] ──

export function logToCommits(entries: ReadCommitResult[]): GitHubCommitResponse[] {
  return entries.map((entry) => ({
    sha: entry.oid,
    commit: {
      message: entry.commit.message,
      author: {
        name: entry.commit.author.name,
        email: entry.commit.author.email,
        date: new Date(entry.commit.author.timestamp * 1000).toISOString(),
      },
      committer: {
        name: entry.commit.committer.name,
        date: new Date(entry.commit.committer.timestamp * 1000).toISOString(),
      },
    },
    author: {
      login: entry.commit.author.name,
      avatar_url: '',
    },
    committer: {
      login: entry.commit.committer.name,
      avatar_url: '',
    },
  }));
}

// ── Shared DiffFile interface ──

interface DiffFile {
  sha: string;
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
}

// ── Helpers for computing line stats per diff status ──

async function computeAddedStats(
  entry: WalkerEntry | null,
): Promise<{ additions: number; deletions: number }> {
  const content = entry ? await entry.content() : null;
  return { additions: content ? countLines(content) : 0, deletions: 0 };
}

async function computeRemovedStats(
  entry: WalkerEntry | null,
): Promise<{ additions: number; deletions: number }> {
  const content = entry ? await entry.content() : null;
  return { additions: 0, deletions: content ? countLines(content) : 0 };
}

async function computeModifiedStats(
  parentEntry: WalkerEntry,
  currentEntry: WalkerEntry,
): Promise<{ additions: number; deletions: number }> {
  const oldContent = await parentEntry.content();
  const newContent = await currentEntry.content();
  if (oldContent && newContent) return countLineDiff(oldContent, newContent);
  return { additions: 0, deletions: 0 };
}

// ── Two-tree diff helper (parent vs current) for full content diff ──

async function diffTwoTrees(
  entries: (WalkerEntry | null)[],
  filepath: string,
): Promise<DiffFile | null> {
  const [parentEntry, currentEntry] = entries;
  const parentOidVal = parentEntry ? await parentEntry.oid() : null;
  const currentOidVal = currentEntry ? await currentEntry.oid() : null;

  if (parentOidVal === currentOidVal) return null;

  const parentType = parentEntry ? await parentEntry.type() : null;
  const currentType = currentEntry ? await currentEntry.type() : null;
  if (parentType === 'tree' || currentType === 'tree') return null;

  const isAdded = !parentEntry || parentOidVal === null;
  const isRemoved = !currentEntry || currentOidVal === null;

  let status: 'added' | 'removed' | 'modified';
  let stats: { additions: number; deletions: number };

  if (isAdded) {
    status = 'added';
    stats = await computeAddedStats(currentEntry);
  } else if (isRemoved) {
    status = 'removed';
    stats = await computeRemovedStats(parentEntry);
  } else {
    status = 'modified';
    stats = await computeModifiedStats(parentEntry!, currentEntry!);
  }

  return {
    sha: currentOidVal || parentOidVal || '',
    filename: filepath,
    status,
    ...stats,
    changes: stats.additions + stats.deletions,
  };
}

// ── Single-tree diff helper (initial commit) for full content diff ──

async function diffSingleTree(
  entries: (WalkerEntry | null)[],
  filepath: string,
): Promise<DiffFile | null> {
  const [entry] = entries;
  if (!entry) return null;
  const type = await entry.type();
  if (type === 'tree') return null;

  const content = await entry.content();
  const additions = content ? countLines(content) : 0;
  const entryOid = await entry.oid();

  return {
    sha: entryOid || '',
    filename: filepath,
    status: 'added',
    additions,
    deletions: 0,
    changes: additions,
  };
}

// ── Diff a single commit against its parent ──

export async function diffCommit(
  fs: FsClient,
  dir: string,
  oid: string,
  parentOid: string | null,
): Promise<
  GitHubCommitDetailResponse['files'] & {
    stats: { additions: number; deletions: number; total: number };
  }
> {
  const files: DiffFile[] = [];

  const trees = parentOid
    ? [git.TREE({ ref: parentOid }), git.TREE({ ref: oid })]
    : [git.TREE({ ref: oid })];

  const diffFn = parentOid ? diffTwoTrees : diffSingleTree;

  await git.walk({
    fs,
    dir,
    trees,
    map: async (filepath: string, entries: (WalkerEntry | null)[] | null) => {
      if (!entries || filepath === '.') return;
      const result = await diffFn(entries, filepath);
      if (result) files.push(result);
    },
  });

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return Object.assign(files, {
    stats: {
      additions: totalAdditions,
      deletions: totalDeletions,
      total: totalAdditions + totalDeletions,
    },
  });
}

// ── Fast diff: OID-only comparison, no content reading ──
// Returns file list with status but estimates additions/deletions as 1 per changed file.
// ~10x faster than full diffCommit since it never reads blob content.

async function diffTwoTreesFast(
  entries: (WalkerEntry | null)[],
  filepath: string,
): Promise<DiffFile | null> {
  const [parentEntry, currentEntry] = entries;
  const parentOidVal = parentEntry ? await parentEntry.oid() : null;
  const currentOidVal = currentEntry ? await currentEntry.oid() : null;

  if (parentOidVal === currentOidVal) return null;

  const parentType = parentEntry ? await parentEntry.type() : null;
  const currentType = currentEntry ? await currentEntry.type() : null;
  if (parentType === 'tree' || currentType === 'tree') return null;

  let status = 'modified';
  let additions = 1;
  let deletions = 1;

  if (!parentEntry || parentOidVal === null) {
    status = 'added';
    deletions = 0;
  } else if (!currentEntry || currentOidVal === null) {
    status = 'removed';
    additions = 0;
  }

  return {
    sha: currentOidVal || parentOidVal || '',
    filename: filepath,
    status,
    additions,
    deletions,
    changes: additions + deletions,
  };
}

async function diffSingleTreeFast(
  entries: (WalkerEntry | null)[],
  filepath: string,
): Promise<DiffFile | null> {
  const [entry] = entries;
  if (!entry) return null;
  const type = await entry.type();
  if (type === 'tree') return null;
  const entryOid = await entry.oid();

  return {
    sha: entryOid || '',
    filename: filepath,
    status: 'added',
    additions: 1,
    deletions: 0,
    changes: 1,
  };
}

export async function diffCommitFast(
  fs: FsClient,
  dir: string,
  oid: string,
  parentOid: string | null,
): Promise<
  GitHubCommitDetailResponse['files'] & {
    stats: { additions: number; deletions: number; total: number };
  }
> {
  const files: DiffFile[] = [];

  const trees = parentOid
    ? [git.TREE({ ref: parentOid }), git.TREE({ ref: oid })]
    : [git.TREE({ ref: oid })];

  const diffFn = parentOid ? diffTwoTreesFast : diffSingleTreeFast;

  await git.walk({
    fs,
    dir,
    trees,
    map: async (filepath: string, entries: (WalkerEntry | null)[] | null) => {
      if (!entries || filepath === '.') return;
      const result = await diffFn(entries, filepath);
      if (result) files.push(result);
    },
  });

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return Object.assign(files, {
    stats: {
      additions: totalAdditions,
      deletions: totalDeletions,
      total: totalAdditions + totalDeletions,
    },
  });
}

function countLines(content: Uint8Array): number {
  // Quick check for binary content
  if (isBinary(content)) return 0;
  let count = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === 10) count++; // newline
  }
  // If content doesn't end with newline, count the last line
  if (content.length > 0 && content[content.length - 1] !== 10) count++;
  return count;
}

export function isBinary(content: Uint8Array): boolean {
  // Check first 8KB for null bytes
  const limit = Math.min(content.length, 8192);
  for (let i = 0; i < limit; i++) {
    if (content[i] === 0) return true;
  }
  return false;
}

/**
 * Count lines of code in a Uint8Array, returning 0 for binary content.
 * Exported for use in git.worker.ts to reduce cognitive complexity.
 */
export function countLinesOfCode(content: Uint8Array): { lines: number; binary: boolean } {
  if (isBinary(content)) return { lines: 0, binary: true };
  let lines = 0;
  for (const byte of content) {
    if (byte === 10) lines++;
  }
  if (content.length > 0 && content.at(-1) !== 10) lines++;
  return { lines, binary: false };
}

function countLineDiff(
  oldContent: Uint8Array,
  newContent: Uint8Array,
): { additions: number; deletions: number } {
  if (isBinary(oldContent) || isBinary(newContent)) {
    return { additions: 0, deletions: 0 };
  }

  const oldLines = splitLines(oldContent);
  const newLines = splitLines(newContent);

  // Simple line-count based diff estimation
  // For accuracy we'd need a full diff algorithm, but for stats purposes
  // we use a set-based approach: lines in new but not old = additions,
  // lines in old but not new = deletions
  const oldSet = new Map<string, number>();
  for (const line of oldLines) {
    oldSet.set(line, (oldSet.get(line) || 0) + 1);
  }

  let additions = 0;
  const newSet = new Map<string, number>();
  for (const line of newLines) {
    newSet.set(line, (newSet.get(line) || 0) + 1);
  }

  // Count additions: lines in new that exceed their count in old
  for (const [line, count] of newSet) {
    const oldCount = oldSet.get(line) || 0;
    if (count > oldCount) additions += count - oldCount;
  }

  // Count deletions: lines in old that exceed their count in new
  let deletions = 0;
  for (const [line, count] of oldSet) {
    const newCount = newSet.get(line) || 0;
    if (count > newCount) deletions += count - newCount;
  }

  return { additions, deletions };
}

function splitLines(content: Uint8Array): string[] {
  const decoder = new TextDecoder();
  return decoder.decode(content).split('\n');
}

// ── Compute language breakdown from file list ──

export function computeLanguages(files: string[]): GitHubLanguages {
  const langs: Record<string, number> = {};

  for (const file of files) {
    const dot = file.lastIndexOf('.');
    if (dot === -1) continue;
    const ext = file.slice(dot + 1).toLowerCase();
    const lang = EXT_LANG[ext];
    if (lang) {
      // Use file count as proxy for bytes (analyzer normalizes to percentages)
      langs[lang] = (langs[lang] || 0) + 1;
    }
  }

  return langs;
}

// ── Compute weekly aggregates from commits + diff data ──

export function computeWeeklyAggregates(
  entries: ReadCommitResult[],
  details: Map<string, { additions: number; deletions: number }>,
): {
  commitActivity: GitHubCommitActivity[];
  codeFrequency: GitHubCodeFrequency[];
  punchCard: GitHubPunchCard[];
  contributorStats: GitHubContributorStats[];
} {
  if (entries.length === 0) {
    return {
      commitActivity: [],
      codeFrequency: [],
      punchCard: [],
      contributorStats: [],
    };
  }

  // ── Punch card (7 days × 24 hours) ──
  const punchGrid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  // ── Group commits by week ──
  // A "week" starts on Sunday, aligned to midnight UTC
  const weekMap = new Map<number, { days: number[]; additions: number; deletions: number }>();
  // Per-author tracking
  const authorMap = new Map<
    string,
    {
      name: string;
      totalCommits: number;
      weeks: Map<number, { a: number; d: number; c: number }>;
    }
  >();

  for (const entry of entries) {
    const ts = entry.commit.author.timestamp;
    const date = new Date(ts * 1000);
    const dayOfWeek = date.getUTCDay(); // 0=Sun
    const hour = date.getUTCHours();

    // Punch card
    punchGrid[dayOfWeek][hour]++;

    // Week start (Sunday midnight UTC)
    const weekStart = getWeekStart(ts);

    // Commit activity
    if (!weekMap.has(weekStart)) {
      weekMap.set(weekStart, { days: [0, 0, 0, 0, 0, 0, 0], additions: 0, deletions: 0 });
    }
    const week = weekMap.get(weekStart)!;
    week.days[dayOfWeek]++;

    // Add diff stats if available
    const diffStats = details.get(entry.oid);
    if (diffStats) {
      week.additions += diffStats.additions;
      week.deletions += diffStats.deletions;
    }

    // Author tracking
    const authorKey = entry.commit.author.email;
    if (!authorMap.has(authorKey)) {
      authorMap.set(authorKey, {
        name: entry.commit.author.name,
        totalCommits: 0,
        weeks: new Map(),
      });
    }
    const author = authorMap.get(authorKey)!;
    author.totalCommits++;
    if (!author.weeks.has(weekStart)) {
      author.weeks.set(weekStart, { a: 0, d: 0, c: 0 });
    }
    const authorWeek = author.weeks.get(weekStart)!;
    authorWeek.c++;
    if (diffStats) {
      authorWeek.a += diffStats.additions;
      authorWeek.d += diffStats.deletions;
    }
  }

  // ── Build commitActivity (sorted by week) ──
  const commitActivity: GitHubCommitActivity[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekTs, data]) => ({
      week: weekTs,
      total: data.days.reduce((s, d) => s + d, 0),
      days: data.days,
    }));

  // ── Build codeFrequency (sorted by week) ──
  const codeFrequency: GitHubCodeFrequency[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekTs, data]) => [weekTs, data.additions, -data.deletions]);

  // ── Build punchCard ──
  const punchCard: GitHubPunchCard[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      punchCard.push([day, hour, punchGrid[day][hour]]);
    }
  }

  // ── Build contributorStats ──
  // Collect all week timestamps
  const allWeeks = Array.from(weekMap.keys()).sort((a, b) => a - b);

  const contributorStats: GitHubContributorStats[] = Array.from(authorMap.entries())
    .map(([, data]) => {
      const weeks: GitHubContributorStatsWeek[] = allWeeks.map((w) => {
        const wk = data.weeks.get(w);
        return {
          w,
          a: wk?.a || 0,
          d: wk?.d || 0,
          c: wk?.c || 0,
        };
      });

      return {
        author: {
          login: data.name,
          avatar_url: '',
        },
        total: data.totalCommits,
        weeks,
      };
    })
    .sort((a, b) => b.total - a.total);

  return { commitActivity, codeFrequency, punchCard, contributorStats };
}

// ── Evenly sample indices ──

export function sampleIndices(total: number, max: number): number[] {
  if (total <= max) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const indices: number[] = [];
  const step = total / max;
  for (let i = 0; i < max; i++) {
    indices.push(Math.floor(i * step));
  }
  return indices;
}

// ── Helper: get week start (Sunday) as unix timestamp ──

function getWeekStart(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000);
  const day = date.getUTCDay(); // 0=Sun
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - day);
  return Math.floor(date.getTime() / 1000);
}

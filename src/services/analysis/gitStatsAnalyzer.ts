import type {
  GitStatsRawData,
  GitStatsAnalysis,
  ContributorSummary,
  BusFactorData,
  FileChurnEntry,
  CommitMessageStats,
  CommitSizeDistribution,
  RepoGrowthPoint,
  PunchCardData,
  WeeklyActivity,
  LanguageEntry,
  AuthorOfPeriod,
  AuthorTimeline,
  ContributorNode,
  ContributorEdge,
  OwnershipEntry,
  ChangeChain,
  ExtMonthlyChurn,
  LinesStatsSummary,
  RadarMetric,
  HotspotEntry,
  ActivePeriod,
} from '../../types/gitStats';

// ── Stopwords for word frequency ──

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'it',
  'that',
  'this',
  'was',
  'are',
  'be',
  'has',
  'had',
  'have',
  'not',
  'as',
  'we',
  'do',
  'if',
  'so',
  'no',
  'up',
  'out',
  'all',
  'can',
  'will',
  'just',
  'into',
  'when',
  'been',
  'some',
  'than',
  'its',
  'also',
  'more',
  'use',
  'new',
  'get',
  'set',
  'only',
  'should',
  'would',
  'could',
  'about',
  'which',
  'each',
  'make',
  'like',
  'them',
  'then',
  'now',
  'any',
  'my',
  'our',
  'their',
  'other',
  'these',
  'those',
  'may',
  'using',
]);

// ── Contributor Summary ──

function buildContributorSummary(raw: GitStatsRawData): ContributorSummary[] {
  if (!raw.contributorStats || raw.contributorStats.length === 0) {
    // Fall back to commit list data
    const authorMap = new Map<string, { commits: number; login: string; avatar: string }>();
    for (const c of raw.commits) {
      const login = c.author?.login || c.commit.author.name;
      const avatar = c.author?.avatar_url || '';
      const entry = authorMap.get(login) || { commits: 0, login, avatar };
      entry.commits++;
      authorMap.set(login, entry);
    }

    const totalCommits = raw.commits.length;
    return Array.from(authorMap.values())
      .map((a) => ({
        login: a.login,
        avatarUrl: a.avatar,
        totalCommits: a.commits,
        totalAdditions: 0,
        totalDeletions: 0,
        commitPercentage: totalCommits > 0 ? (a.commits / totalCommits) * 100 : 0,
        firstCommitWeek: 0,
        lastCommitWeek: 0,
      }))
      .sort((a, b) => b.totalCommits - a.totalCommits);
  }

  const totalCommits = raw.contributorStats.reduce((sum, c) => sum + c.total, 0);

  return raw.contributorStats
    .map((c) => {
      const additions = c.weeks.reduce((sum, w) => sum + w.a, 0);
      const deletions = c.weeks.reduce((sum, w) => sum + w.d, 0);
      const activeWeeks = c.weeks.filter((w) => w.c > 0);
      const firstWeek = activeWeeks.length > 0 ? activeWeeks[0].w : 0;
      const lastWeek = activeWeeks.length > 0 ? activeWeeks[activeWeeks.length - 1].w : 0;

      return {
        login: c.author.login,
        avatarUrl: c.author.avatar_url,
        totalCommits: c.total,
        totalAdditions: additions,
        totalDeletions: deletions,
        commitPercentage: totalCommits > 0 ? (c.total / totalCommits) * 100 : 0,
        firstCommitWeek: firstWeek,
        lastCommitWeek: lastWeek,
      };
    })
    .sort((a, b) => b.totalCommits - a.totalCommits);
}

// ── Bus Factor ──

function computeBusFactor(contributors: ContributorSummary[]): BusFactorData {
  if (contributors.length === 0) {
    return { busFactor: 0, herfindahlIndex: 0, cumulativeContributors: [] };
  }

  // Sort by commits descending
  const sorted = [...contributors].sort((a, b) => b.commitPercentage - a.commitPercentage);

  // Walk cumulative percentage until >= 50%
  let cumulative = 0;
  let busFactor = 0;
  const cumulativeContributors: { login: string; cumulativePercentage: number }[] = [];

  for (const c of sorted) {
    cumulative += c.commitPercentage;
    busFactor++;
    cumulativeContributors.push({
      login: c.login,
      cumulativePercentage: cumulative,
    });
    if (cumulative >= 50) break;
  }

  // Add remaining contributors for full curve
  for (let i = busFactor; i < sorted.length; i++) {
    cumulative += sorted[i].commitPercentage;
    cumulativeContributors.push({
      login: sorted[i].login,
      cumulativePercentage: cumulative,
    });
  }

  // Herfindahl-Hirschman Index
  const herfindahlIndex = contributors.reduce(
    (sum, c) => sum + Math.pow(c.commitPercentage / 100, 2),
    0,
  );

  return { busFactor, herfindahlIndex, cumulativeContributors };
}

// ── File Churn ──

function buildFileChurn(raw: GitStatsRawData): FileChurnEntry[] {
  if (raw.commitDetails.length === 0) return [];

  const fileMap = new Map<string, FileChurnEntry>();

  for (const detail of raw.commitDetails) {
    if (!detail.files) continue;
    const authorLogin = detail.author?.login || detail.commit.author.name;

    for (const file of detail.files) {
      const existing = fileMap.get(file.filename);
      if (existing) {
        existing.changeCount++;
        existing.totalAdditions += file.additions;
        existing.totalDeletions += file.deletions;
        if (!existing.contributors.includes(authorLogin)) {
          existing.contributors.push(authorLogin);
        }
      } else {
        fileMap.set(file.filename, {
          filename: file.filename,
          changeCount: 1,
          totalAdditions: file.additions,
          totalDeletions: file.deletions,
          contributors: [authorLogin],
        });
      }
    }
  }

  return Array.from(fileMap.values())
    .sort((a, b) => b.changeCount - a.changeCount)
    .slice(0, 100);
}

// ── Commit Message Analysis ──

function analyzeCommitMessages(raw: GitStatsRawData): CommitMessageStats {
  const messages = raw.commits.map((c) => c.commit.message);
  const totalCommits = messages.length;

  if (totalCommits === 0) {
    return {
      totalCommits: 0,
      averageLength: 0,
      medianLength: 0,
      mergeCommitCount: 0,
      conventionalCommits: {
        feat: 0,
        fix: 0,
        docs: 0,
        style: 0,
        refactor: 0,
        test: 0,
        chore: 0,
        ci: 0,
        perf: 0,
        build: 0,
        other: 0,
      },
      conventionalPercentage: 0,
      wordFrequency: [],
    };
  }

  // Lengths
  const lengths = messages.map((m) => m.length);
  const averageLength = Math.round(lengths.reduce((a, b) => a + b, 0) / totalCommits);
  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const medianLength = sortedLengths[Math.floor(sortedLengths.length / 2)];

  // Merge commits
  const mergeCommitCount = messages.filter(
    (m) => m.startsWith('Merge ') || m.startsWith('Merge pull request'),
  ).length;

  // Conventional commits
  const conventionalTypes: Record<string, keyof CommitMessageStats['conventionalCommits']> = {
    feat: 'feat',
    fix: 'fix',
    docs: 'docs',
    style: 'style',
    refactor: 'refactor',
    test: 'test',
    chore: 'chore',
    ci: 'ci',
    perf: 'perf',
    build: 'build',
  };

  const conventional: CommitMessageStats['conventionalCommits'] = {
    feat: 0,
    fix: 0,
    docs: 0,
    style: 0,
    refactor: 0,
    test: 0,
    chore: 0,
    ci: 0,
    perf: 0,
    build: 0,
    other: 0,
  };

  let conventionalCount = 0;
  for (const msg of messages) {
    const match = msg.match(/^(\w+)(?:\(.*?\))?!?:/);
    if (match) {
      const type = match[1].toLowerCase();
      if (type in conventionalTypes) {
        conventional[conventionalTypes[type]]++;
      } else {
        conventional.other++;
      }
      conventionalCount++;
    }
  }

  const conventionalPercentage =
    totalCommits > 0 ? Math.round((conventionalCount / totalCommits) * 100) : 0;

  // Word frequency
  const wordCounts = new Map<string, number>();
  for (const msg of messages) {
    // Take first line only
    const firstLine = msg.split('\n')[0];
    // Remove conventional commit prefix
    const cleaned = firstLine.replace(/^\w+(?:\(.*?\))?!?:\s*/, '');
    const words = cleaned
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2);
    for (const word of words) {
      if (!STOPWORDS.has(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  const wordFrequency = Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 80);

  return {
    totalCommits,
    averageLength,
    medianLength,
    mergeCommitCount,
    conventionalCommits: conventional,
    conventionalPercentage,
    wordFrequency,
  };
}

// ── Commit Size Distribution ──

function buildCommitSizeDistribution(raw: GitStatsRawData): CommitSizeDistribution {
  const bucketDefs = [
    { label: '0', min: 0, max: 0 },
    { label: '1-10', min: 1, max: 10 },
    { label: '11-50', min: 11, max: 50 },
    { label: '51-100', min: 51, max: 100 },
    { label: '101-500', min: 101, max: 500 },
    { label: '501-1000', min: 501, max: 1000 },
    { label: '1000+', min: 1001, max: Infinity },
  ];

  const buckets = bucketDefs.map((d) => ({ ...d, count: 0 }));

  for (const detail of raw.commitDetails) {
    const size = detail.stats.additions + detail.stats.deletions;
    for (const bucket of buckets) {
      if (size >= bucket.min && size <= bucket.max) {
        bucket.count++;
        break;
      }
    }
  }

  return { buckets };
}

// ── Repo Growth ──

function buildRepoGrowth(raw: GitStatsRawData): RepoGrowthPoint[] {
  if (!raw.codeFrequency || raw.codeFrequency.length === 0) return [];

  let cumulativeAdditions = 0;
  let cumulativeDeletions = 0;

  return raw.codeFrequency.map(([timestamp, additions, deletions]) => {
    cumulativeAdditions += additions;
    cumulativeDeletions += Math.abs(deletions);
    return {
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      cumulativeAdditions,
      cumulativeDeletions,
      netGrowth: cumulativeAdditions - cumulativeDeletions,
    };
  });
}

// ── Punch Card ──

function buildPunchCard(raw: GitStatsRawData): PunchCardData[] {
  if (!raw.punchCard || raw.punchCard.length === 0) return [];

  return raw.punchCard.map(([day, hour, commits]) => ({
    day,
    hour,
    commits,
  }));
}

// ── Weekly Activity ──

function buildWeeklyActivity(raw: GitStatsRawData): WeeklyActivity[] {
  if (!raw.commitActivity || raw.commitActivity.length === 0) return [];

  return raw.commitActivity.map((week) => ({
    weekStart: new Date(week.week * 1000).toISOString().split('T')[0],
    total: week.total,
    days: week.days,
  }));
}

// ── Language Breakdown ──

function buildLanguageBreakdown(raw: GitStatsRawData): LanguageEntry[] {
  if (!raw.languages) return [];

  const entries = Object.entries(raw.languages);
  const totalBytes = entries.reduce((sum, [, bytes]) => sum + bytes, 0);

  if (totalBytes === 0) return [];

  return entries
    .map(([name, bytes]) => ({
      name,
      bytes,
      percentage: Math.round((bytes / totalBytes) * 1000) / 10,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

// ── Commits by Weekday ──

function buildCommitsByWeekday(raw: GitStatsRawData): number[] {
  const totals = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
  for (const commit of raw.commits) {
    const day = new Date(commit.commit.author.date).getDay();
    totals[day]++;
  }
  return totals;
}

// ── Commits by Month ──

function buildCommitsByMonth(raw: GitStatsRawData): number[] {
  const totals = new Array(12).fill(0); // Jan..Dec
  for (const commit of raw.commits) {
    const month = new Date(commit.commit.author.date).getMonth();
    totals[month]++;
  }
  return totals;
}

// ── Commits by Year ──

function buildCommitsByYear(raw: GitStatsRawData): { year: number; count: number }[] {
  const yearMap = new Map<number, number>();
  for (const commit of raw.commits) {
    const year = new Date(commit.commit.author.date).getFullYear();
    yearMap.set(year, (yearMap.get(year) || 0) + 1);
  }
  return [...yearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
}

// ── Commits by File Extension ──

function buildCommitsByExtension(raw: GitStatsRawData): { ext: string; count: number }[] {
  const extMap = new Map<string, number>();
  for (const detail of raw.commitDetails) {
    if (!detail.files) continue;
    const seenExts = new Set<string>();
    for (const file of detail.files) {
      const dotIndex = file.filename.lastIndexOf('.');
      const ext = dotIndex > 0 ? file.filename.slice(dotIndex) : '(no ext)';
      seenExts.add(ext);
    }
    for (const ext of seenExts) {
      extMap.set(ext, (extMap.get(ext) || 0) + 1);
    }
  }
  return [...extMap.entries()]
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

// ── Lines by Extension ──

function buildLinesByExtension(
  raw: GitStatsRawData,
): { ext: string; additions: number; deletions: number }[] {
  const extMap = new Map<string, { additions: number; deletions: number }>();
  for (const detail of raw.commitDetails) {
    if (!detail.files) continue;
    for (const file of detail.files) {
      const dotIndex = file.filename.lastIndexOf('.');
      const ext = dotIndex > 0 ? file.filename.slice(dotIndex) : '(no ext)';
      const existing = extMap.get(ext) || { additions: 0, deletions: 0 };
      existing.additions += file.additions;
      existing.deletions += file.deletions;
      extMap.set(ext, existing);
    }
  }
  return [...extMap.entries()]
    .map(([ext, { additions, deletions }]) => ({ ext, additions, deletions }))
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, 20);
}

// ── File Coupling ──

function buildFileCoupling(
  raw: GitStatsRawData,
): { file1: string; file2: string; cochanges: number }[] {
  const pairMap = new Map<string, number>();

  for (const detail of raw.commitDetails) {
    if (!detail.files || detail.files.length < 2 || detail.files.length > 50) continue;
    const filenames = detail.files.map((f) => f.filename).sort((a, b) => a.localeCompare(b));
    // Only look at first 20 files per commit to limit computation
    const limited = filenames.slice(0, 20);
    for (let i = 0; i < limited.length; i++) {
      for (let j = i + 1; j < limited.length; j++) {
        const key = `${limited[i]}|||${limited[j]}`;
        pairMap.set(key, (pairMap.get(key) || 0) + 1);
      }
    }
  }

  return [...pairMap.entries()]
    .filter(([, count]) => count >= 3)
    .map(([key, cochanges]) => {
      const [file1, file2] = key.split('|||');
      return { file1, file2, cochanges };
    })
    .sort((a, b) => b.cochanges - a.cochanges)
    .slice(0, 20);
}

// ── First Commit & Repo Age ──

function computeFirstCommitDate(raw: GitStatsRawData): string {
  if (raw.commits.length === 0) return '';
  const dates = raw.commits.map((c) => new Date(c.commit.author.date).getTime());
  return new Date(Math.min(...dates)).toISOString();
}

function computeRepoAgeDays(firstCommitDate: string): number {
  if (!firstCommitDate) return 0;
  const first = new Date(firstCommitDate).getTime();
  const now = Date.now();
  return Math.floor((now - first) / (1000 * 60 * 60 * 24));
}

// ── Commits by Hour ──

function buildCommitsByHour(raw: GitStatsRawData): number[] {
  const hours = new Array(24).fill(0);
  for (const c of raw.commits) {
    hours[new Date(c.commit.author.date).getUTCHours()]++;
  }
  return hours;
}

// ── Commits by Email Domain ──

function buildCommitsByDomain(raw: GitStatsRawData): { domain: string; count: number }[] {
  const domainMap = new Map<string, number>();
  for (const c of raw.commits) {
    const email = c.commit.author.email;
    const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : 'unknown';
    domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
  }
  return [...domainMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
}

// ── Author of Year / Month ──

function buildAuthorOfPeriod(
  raw: GitStatsRawData,
  keyFn: (date: Date) => string,
  limit?: number,
): AuthorOfPeriod[] {
  const periodMap = new Map<string, Map<string, number>>();
  for (const c of raw.commits) {
    const d = new Date(c.commit.author.date);
    const key = keyFn(d);
    const name = c.commit.author.name;
    if (!periodMap.has(key)) periodMap.set(key, new Map());
    const authors = periodMap.get(key)!;
    authors.set(name, (authors.get(name) || 0) + 1);
  }

  const results: AuthorOfPeriod[] = [];
  for (const [period, authors] of periodMap) {
    let topAuthor = '';
    let topCount = 0;
    for (const [name, count] of authors) {
      if (count > topCount) {
        topAuthor = name;
        topCount = count;
      }
    }
    results.push({ period, authorName: topAuthor, commits: topCount, totalAuthors: authors.size });
  }

  results.sort((a, b) => b.period.localeCompare(a.period));
  return limit ? results.slice(0, limit) : results;
}

function buildAuthorOfYear(raw: GitStatsRawData): AuthorOfPeriod[] {
  return buildAuthorOfPeriod(raw, (d) => String(d.getFullYear()));
}

function buildAuthorOfMonth(raw: GitStatsRawData): AuthorOfPeriod[] {
  return buildAuthorOfPeriod(
    raw,
    (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    24,
  );
}

// ── Author Timelines ──

function buildAuthorTimelines(raw: GitStatsRawData, topN: number = 5): AuthorTimeline[] {
  const authorCounts = new Map<string, number>();
  for (const c of raw.commits) {
    const name = c.commit.author.name;
    authorCounts.set(name, (authorCounts.get(name) || 0) + 1);
  }
  const topAuthors = [...authorCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([name]) => name);

  const topSet = new Set(topAuthors);
  const timelineMap = new Map<string, Map<string, number>>();
  for (const name of topAuthors) timelineMap.set(name, new Map());

  for (const c of raw.commits) {
    const name = c.commit.author.name;
    if (!topSet.has(name)) continue;
    const d = new Date(c.commit.author.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const months = timelineMap.get(name)!;
    months.set(month, (months.get(month) || 0) + 1);
  }

  return topAuthors.map((name) => ({
    authorName: name,
    points: [...timelineMap.get(name)!.entries()].sort(([a], [b]) => a.localeCompare(b)),
  }));
}

// ── Contributor Network ──

function buildContributorNetwork(raw: GitStatsRawData): {
  nodes: ContributorNode[];
  edges: ContributorEdge[];
} {
  if (raw.commitDetails.length === 0) return { nodes: [], edges: [] };

  // Map files to authors who touched them
  const fileAuthors = new Map<string, Set<string>>();
  for (const detail of raw.commitDetails) {
    if (!detail.files) continue;
    const author = detail.author?.login || detail.commit.author.name;
    for (const f of detail.files) {
      if (!fileAuthors.has(f.filename)) fileAuthors.set(f.filename, new Set());
      fileAuthors.get(f.filename)!.add(author);
    }
  }

  // Build edges: authors who share files
  const edgeMap = new Map<string, number>();
  for (const authors of fileAuthors.values()) {
    const arr = [...authors];
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const key = [arr[i], arr[j]].sort().join('|||');
        edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
      }
    }
  }

  // Top edges by weight
  const edges: ContributorEdge[] = [...edgeMap.entries()]
    .map(([key, weight]) => {
      const [source, target] = key.split('|||');
      return { source, target, weight };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 50);

  // Nodes from edges
  const nodeSet = new Set<string>();
  for (const e of edges) {
    nodeSet.add(e.source);
    nodeSet.add(e.target);
  }
  const nodes: ContributorNode[] = [...nodeSet].map((id) => ({ id, name: id }));

  return { nodes, edges };
}

// ── Code Ownership ──

function buildCodeOwnership(raw: GitStatsRawData): OwnershipEntry[] {
  if (raw.commitDetails.length === 0) return [];

  const dirOwnership = new Map<string, Map<string, number>>();
  for (const detail of raw.commitDetails) {
    if (!detail.files) continue;
    const author = detail.author?.login || detail.commit.author.name;
    for (const f of detail.files) {
      const parts = f.filename.split('/');
      const dir = parts.length > 1 ? parts.slice(0, 2).join('/') : parts[0];
      if (!dirOwnership.has(dir)) dirOwnership.set(dir, new Map());
      const authors = dirOwnership.get(dir)!;
      authors.set(author, (authors.get(author) || 0) + f.additions);
    }
  }

  const results: OwnershipEntry[] = [];
  for (const [path, authors] of dirOwnership) {
    let topAuthor = '';
    let topLines = 0;
    let totalLines = 0;
    for (const [name, lines] of authors) {
      totalLines += lines;
      if (lines > topLines) {
        topAuthor = name;
        topLines = lines;
      }
    }
    if (totalLines > 0) results.push({ path, ownerName: topAuthor, lines: totalLines });
  }

  return results.sort((a, b) => b.lines - a.lines).slice(0, 50);
}

// ── Timezone Data ──

function buildTimezoneData(raw: GitStatsRawData): { offset: number; count: number }[] {
  // GitHub normalizes to UTC, so we approximate from commit hour patterns
  // Group by UTC hour and report as-is
  const hourCounts = new Map<number, number>();
  for (const c of raw.commits) {
    const hour = new Date(c.commit.author.date).getUTCHours();
    // Estimate timezone: assume most work happens 9-17 local time
    // offset = hour - 13 (midpoint of workday)
    const offset = hour >= 13 ? hour - 13 : hour - 13 + 24;
    const normalizedOffset = offset > 12 ? offset - 24 : offset;
    hourCounts.set(normalizedOffset, (hourCounts.get(normalizedOffset) || 0) + 1);
  }
  return [...hourCounts.entries()]
    .map(([offset, count]) => ({ offset, count }))
    .sort((a, b) => a.offset - b.offset);
}

// ── Sequential Coupling ──

function buildSequentialCoupling(raw: GitStatsRawData): ChangeChain[] {
  if (raw.commitDetails.length < 2) return [];

  // Sort commits by date
  const sorted = [...raw.commitDetails]
    .filter((d) => d.files && d.files.length > 0)
    .sort(
      (a, b) => new Date(a.commit.author.date).getTime() - new Date(b.commit.author.date).getTime(),
    );

  // Track file pairs in consecutive commits within 24h
  const chainMap = new Map<string, { count: number; spans: number[] }>();
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    const span =
      (new Date(next.commit.author.date).getTime() - new Date(curr.commit.author.date).getTime()) /
      3600000;
    if (span > 24) continue;

    const currFiles = new Set(curr.files!.map((f) => f.filename));
    const nextFiles = new Set(next.files!.map((f) => f.filename));

    // Find files that appear in both consecutive commits
    for (const f of currFiles) {
      if (nextFiles.has(f)) {
        const key = f;
        const entry = chainMap.get(key) || { count: 0, spans: [] };
        entry.count++;
        entry.spans.push(span);
        chainMap.set(key, entry);
      }
    }
  }

  return [...chainMap.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([file, v]) => ({
      files: [file],
      occurrences: v.count,
      avgSpanHours: v.spans.reduce((a, b) => a + b, 0) / v.spans.length,
      confidence: Math.min(v.count / 10, 1.0),
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20);
}

// ── Lines by Extension Over Time ──

function buildLinesByExtTime(raw: GitStatsRawData): ExtMonthlyChurn | null {
  if (raw.commitDetails.length === 0) return null;

  const monthExtMap = new Map<string, Map<string, number>>();
  for (const detail of raw.commitDetails) {
    if (!detail.files) continue;
    const d = new Date(detail.commit.author.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthExtMap.has(month)) monthExtMap.set(month, new Map());
    const exts = monthExtMap.get(month)!;
    for (const f of detail.files) {
      const dotIndex = f.filename.lastIndexOf('.');
      const ext = dotIndex > 0 ? f.filename.slice(dotIndex + 1) : 'other';
      exts.set(ext, (exts.get(ext) || 0) + f.additions + f.deletions);
    }
  }

  const months = [...monthExtMap.keys()].sort();
  const allExts = new Set<string>();
  for (const exts of monthExtMap.values()) {
    for (const ext of exts.keys()) allExts.add(ext);
  }

  // Top 8 extensions by total churn
  const extTotals = new Map<string, number>();
  for (const exts of monthExtMap.values()) {
    for (const [ext, count] of exts) {
      extTotals.set(ext, (extTotals.get(ext) || 0) + count);
    }
  }
  const extensions = [...extTotals.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([ext]) => ext);

  const data = extensions.map((ext) => months.map((m) => monthExtMap.get(m)?.get(ext) || 0));

  return { months, extensions, data };
}

// ── Lines Stats Summary ──

function buildLinesStatsSummary(raw: GitStatsRawData): LinesStatsSummary[] {
  if (raw.commitDetails.length === 0) return [];

  const perCommit = raw.commitDetails.map((d) => d.stats.additions + d.stats.deletions);
  perCommit.sort((a, b) => a - b);

  const sum = perCommit.reduce((a, b) => a + b, 0);
  const median = perCommit[Math.floor(perCommit.length / 2)];

  return [
    {
      label: 'Per Commit',
      min: perCommit[0],
      max: perCommit[perCommit.length - 1],
      avg: Math.round(sum / perCommit.length),
      median,
      total: sum,
    },
  ];
}

// ── Cumulative Files ──

function buildCumulativeFiles(raw: GitStatsRawData): { date: string; count: number }[] {
  if (raw.commitDetails.length === 0) return [];

  const sorted = [...raw.commitDetails].sort(
    (a, b) => new Date(a.commit.author.date).getTime() - new Date(b.commit.author.date).getTime(),
  );

  const seen = new Set<string>();
  const monthMap = new Map<string, number>();

  for (const detail of sorted) {
    if (!detail.files) continue;
    for (const f of detail.files) {
      if (f.status !== 'removed') seen.add(f.filename);
      else seen.delete(f.filename);
    }
    const d = new Date(detail.commit.author.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(month, seen.size);
  }

  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

// ── File Operations ──

function buildFileOperations(raw: GitStatsRawData): { operation: string; count: number }[] {
  const ops = new Map<string, number>();
  for (const detail of raw.commitDetails) {
    if (!detail.files) continue;
    for (const f of detail.files) {
      const op = f.status || 'modified';
      ops.set(op, (ops.get(op) || 0) + 1);
    }
  }
  return [...ops.entries()]
    .map(([operation, count]) => ({ operation, count }))
    .sort((a, b) => b.count - a.count);
}

// ── LOC Over Time ──

function buildLocOverTime(raw: GitStatsRawData): { date: string; loc: number }[] {
  if (!raw.codeFrequency || raw.codeFrequency.length === 0) return [];

  let cumulative = 0;
  return raw.codeFrequency.map(([timestamp, additions, deletions]) => {
    cumulative += additions + deletions; // deletions are negative
    return {
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      loc: cumulative,
    };
  });
}

// ── Radar Metrics ──

function buildRadarMetrics(
  raw: GitStatsRawData,
  contributors: ContributorSummary[],
  busFactor: BusFactorData,
  commitMessages: CommitMessageStats,
): RadarMetric[] {
  const totalCommits = raw.commits.length;
  const totalAuthors = contributors.length;

  // Activity: normalized by 1000 commits
  const activity = Math.min(totalCommits / 1000, 1.0);

  // Team Size: normalized by 20 authors
  const teamSize = Math.min(totalAuthors / 20, 1.0);

  // Bus Factor: normalized by 5
  const busFactorScore = Math.min(busFactor.busFactor / 5, 1.0);

  // Code Balance: how balanced are insertions vs deletions
  const totalIns = raw.commitDetails.reduce((s, d) => s + d.stats.additions, 0);
  const totalDel = raw.commitDetails.reduce((s, d) => s + d.stats.deletions, 0);
  const total = totalIns + totalDel;
  const codeBalance = total > 0 ? 1.0 - Math.abs(totalIns - totalDel) / total : 0.5;

  // Commit Hygiene: conventional commit adoption
  const commitHygiene = Math.min(commitMessages.conventionalPercentage / 100, 1.0);

  // Recency: days since last commit (1.0 = today, 0.0 = 365+ days ago)
  const lastDate =
    raw.commits.length > 0
      ? Math.max(...raw.commits.map((c) => new Date(c.commit.author.date).getTime()))
      : Date.now();
  const daysSinceLast = (Date.now() - lastDate) / 86400000;
  const recency = Math.max(0, 1.0 - daysSinceLast / 365);

  return [
    { label: 'Activity', value: Math.round(activity * 100) / 100 },
    { label: 'Team Size', value: Math.round(teamSize * 100) / 100 },
    { label: 'Bus Factor', value: Math.round(busFactorScore * 100) / 100 },
    { label: 'Code Balance', value: Math.round(codeBalance * 100) / 100 },
    { label: 'Commit Hygiene', value: Math.round(commitHygiene * 100) / 100 },
    { label: 'Recency', value: Math.round(recency * 100) / 100 },
  ];
}

// ── Hotspots ──

function buildHotspots(fileChurn: FileChurnEntry[]): HotspotEntry[] {
  return fileChurn.slice(0, 30).map((f) => ({
    path: f.filename,
    commits: f.changeCount,
    distinctAuthors: f.contributors.length,
    totalChurn: f.totalAdditions + f.totalDeletions,
  }));
}

// ── Top Active Periods ──

function buildTopActivePeriods(raw: GitStatsRawData): ActivePeriod[] {
  const monthMap = new Map<string, { commits: number; insertions: number; deletions: number }>();

  for (const detail of raw.commitDetails) {
    const d = new Date(detail.commit.author.date);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = monthMap.get(month) || { commits: 0, insertions: 0, deletions: 0 };
    entry.commits++;
    entry.insertions += detail.stats.additions;
    entry.deletions += detail.stats.deletions;
    monthMap.set(month, entry);
  }

  return [...monthMap.entries()]
    .map(([period, stats]) => ({ period, ...stats }))
    .sort(
      (a, b) => b.commits + b.insertions + b.deletions - (a.commits + a.insertions + a.deletions),
    )
    .slice(0, 10);
}

// ── Main analysis function ──

export function analyzeGitStats(
  rawData: GitStatsRawData,
  owner: string,
  repo: string,
): GitStatsAnalysis {
  const contributors = buildContributorSummary(rawData);
  const busFactor = computeBusFactor(contributors);
  const fileChurn = buildFileChurn(rawData);
  const commitMessages = analyzeCommitMessages(rawData);
  const commitSizeDistribution = buildCommitSizeDistribution(rawData);
  const repoGrowth = buildRepoGrowth(rawData);
  const punchCard = buildPunchCard(rawData);
  const weeklyActivity = buildWeeklyActivity(rawData);
  const languages = buildLanguageBreakdown(rawData);
  const commitsByWeekday = buildCommitsByWeekday(rawData);
  const commitsByMonth = buildCommitsByMonth(rawData);
  const commitsByYear = buildCommitsByYear(rawData);
  const commitsByExtension = buildCommitsByExtension(rawData);
  const linesByExtension = buildLinesByExtension(rawData);
  const fileCoupling = buildFileCoupling(rawData);
  const firstCommitDate = computeFirstCommitDate(rawData);
  const repoAgeDays = computeRepoAgeDays(firstCommitDate);
  const commitsByHour = buildCommitsByHour(rawData);
  const commitsByDomain = buildCommitsByDomain(rawData);
  const authorOfYear = buildAuthorOfYear(rawData);
  const authorOfMonth = buildAuthorOfMonth(rawData);
  const authorTimelines = buildAuthorTimelines(rawData);
  const network = buildContributorNetwork(rawData);
  const codeOwnership = buildCodeOwnership(rawData);
  const timezoneData = buildTimezoneData(rawData);
  const sequentialCoupling = buildSequentialCoupling(rawData);
  const linesByExtTime = buildLinesByExtTime(rawData);
  const linesStatsSummary = buildLinesStatsSummary(rawData);
  const cumulativeFiles = buildCumulativeFiles(rawData);
  const fileOperations = buildFileOperations(rawData);
  const locOverTime = buildLocOverTime(rawData);
  const radarMetrics = buildRadarMetrics(rawData, contributors, busFactor, commitMessages);
  const hotspots = buildHotspots(fileChurn);
  const topActivePeriods = buildTopActivePeriods(rawData);

  return {
    owner,
    repo,
    totalCommits: rawData.commits.length,
    totalLinesOfCode: rawData.totalLinesOfCode ?? 0,
    binaryFileCount: rawData.binaryFileCount ?? 0,
    contributors,
    busFactor,
    fileChurn,
    commitMessages,
    commitSizeDistribution,
    repoGrowth,
    punchCard,
    weeklyActivity,
    languages,
    commitActivity: rawData.commitActivity,
    codeFrequency: rawData.codeFrequency,
    commitsByWeekday,
    commitsByMonth,
    commitsByYear,
    commitsByExtension,
    linesByExtension,
    fileCoupling,
    firstCommitDate,
    repoAgeDays,
    commitsByHour,
    commitsByDomain,
    authorOfYear,
    authorOfMonth,
    authorTimelines,
    contributorNodes: network.nodes,
    contributorEdges: network.edges,
    codeOwnership,
    timezoneData,
    sequentialCoupling,
    linesByExtTime,
    linesStatsSummary,
    cumulativeFiles,
    fileOperations,
    tagHistory: [],
    locOverTime,
    radarMetrics,
    hotspots,
    topActivePeriods,
  };
}

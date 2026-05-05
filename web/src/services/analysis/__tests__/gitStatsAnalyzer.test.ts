import { describe, it, expect, vi, afterEach } from 'vitest';
import { analyzeGitStats } from '../gitStatsAnalyzer';
import type {
  GitStatsRawData,
  GitHubCommitResponse,
  GitHubCommitDetailResponse,
  GitHubContributorStats,
} from '../../../types/gitStats';

// ── Helpers ──

/** Minimal empty raw data object. */
function emptyRaw(): GitStatsRawData {
  return {
    commits: [],
    commitDetails: [],
    contributorStats: null,
    codeFrequency: null,
    commitActivity: null,
    participation: null,
    punchCard: null,
    languages: null,
  };
}

/** Shorthand to build a commit entry. */
function makeCommit(
  sha: string,
  message: string,
  authorLogin: string,
  date: string,
  avatarUrl = '',
): GitHubCommitResponse {
  return {
    sha,
    commit: {
      message,
      author: { name: authorLogin, email: `${authorLogin}@test.com`, date },
      committer: { name: authorLogin, date },
    },
    author: { login: authorLogin, avatar_url: avatarUrl },
    committer: null,
  };
}

/** Shorthand to build a commit detail entry. */
function makeDetail(
  sha: string,
  authorLogin: string,
  additions: number,
  deletions: number,
  files: { filename: string; additions: number; deletions: number }[] = [],
): GitHubCommitDetailResponse {
  return {
    sha,
    commit: {
      message: '',
      author: { name: authorLogin, email: `${authorLogin}@test.com`, date: '2024-01-01T00:00:00Z' },
    },
    author: { login: authorLogin },
    stats: { total: additions + deletions, additions, deletions },
    files: files.map((f) => ({
      sha: 'abc',
      filename: f.filename,
      status: 'modified',
      additions: f.additions,
      deletions: f.deletions,
      changes: f.additions + f.deletions,
    })),
  };
}

/** Build a contributor stats entry. */
function makeContributorStats(
  login: string,
  total: number,
  weeks: { w: number; a: number; d: number; c: number }[],
  avatar = '',
): GitHubContributorStats {
  return {
    author: { login, avatar_url: avatar },
    total,
    weeks,
  };
}

// ── Tests ──

describe('analyzeGitStats', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Top-level properties ──

  describe('top-level properties', () => {
    it('returns owner and repo from arguments', () => {
      const result = analyzeGitStats(emptyRaw(), 'my-org', 'my-repo');
      expect(result.owner).toBe('my-org');
      expect(result.repo).toBe('my-repo');
    });

    it('returns totalCommits matching commits array length', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'init', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'add', 'bob', '2024-01-02T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.totalCommits).toBe(2);
    });

    it('returns totalLinesOfCode defaulting to 0 when absent', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.totalLinesOfCode).toBe(0);
    });

    it('returns totalLinesOfCode when provided', () => {
      const raw = emptyRaw();
      raw.totalLinesOfCode = 42000;
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.totalLinesOfCode).toBe(42000);
    });

    it('returns binaryFileCount defaulting to 0 when absent', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.binaryFileCount).toBe(0);
    });

    it('returns binaryFileCount when provided', () => {
      const raw = emptyRaw();
      raw.binaryFileCount = 5;
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.binaryFileCount).toBe(5);
    });

    it('passes through commitActivity and codeFrequency as-is', () => {
      const raw = emptyRaw();
      raw.commitActivity = [{ week: 1700000000, total: 5, days: [0, 1, 1, 1, 1, 1, 0] }];
      raw.codeFrequency = [[1700000000, 100, -50]];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitActivity).toBe(raw.commitActivity);
      expect(result.codeFrequency).toBe(raw.codeFrequency);
    });
  });

  // ── buildContributorSummary ──

  describe('buildContributorSummary (via contributors)', () => {
    it('returns empty array with no commits and no contributorStats', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.contributors).toEqual([]);
    });

    it('falls back to commits data when contributorStats is null', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'init', 'alice', '2024-01-01T00:00:00Z', 'https://avatar/alice'),
        makeCommit('b', 'fix', 'alice', '2024-01-02T00:00:00Z', 'https://avatar/alice'),
        makeCommit('c', 'add', 'bob', '2024-01-03T00:00:00Z', 'https://avatar/bob'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');

      expect(result.contributors).toHaveLength(2);
      // Sorted by totalCommits desc
      expect(result.contributors[0].login).toBe('alice');
      expect(result.contributors[0].totalCommits).toBe(2);
      expect(result.contributors[0].avatarUrl).toBe('https://avatar/alice');
      expect(result.contributors[0].totalAdditions).toBe(0);
      expect(result.contributors[0].totalDeletions).toBe(0);
      expect(result.contributors[0].firstCommitWeek).toBe(0);
      expect(result.contributors[0].lastCommitWeek).toBe(0);
      expect(result.contributors[1].login).toBe('bob');
      expect(result.contributors[1].totalCommits).toBe(1);
    });

    it('computes commitPercentage in fallback path', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'init', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'fix', 'alice', '2024-01-02T00:00:00Z'),
        makeCommit('c', 'add', 'bob', '2024-01-03T00:00:00Z'),
        makeCommit('d', 'test', 'bob', '2024-01-04T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.contributors[0].commitPercentage).toBe(50);
      expect(result.contributors[1].commitPercentage).toBe(50);
    });

    it('uses commit.author.name when author.login is missing in fallback', () => {
      const raw = emptyRaw();
      raw.commits = [
        {
          sha: 'a',
          commit: {
            message: 'init',
            author: { name: 'Name Only', email: 'n@t.com', date: '2024-01-01T00:00:00Z' },
            committer: { name: 'Name Only', date: '2024-01-01T00:00:00Z' },
          },
          author: null,
          committer: null,
        },
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.contributors[0].login).toBe('Name Only');
      expect(result.contributors[0].avatarUrl).toBe('');
    });

    it('uses contributorStats when available', () => {
      const raw = emptyRaw();
      raw.commits = [makeCommit('a', 'x', 'alice', '2024-01-01T00:00:00Z')];
      raw.contributorStats = [
        makeContributorStats(
          'alice',
          10,
          [
            { w: 1700000000, a: 500, d: 100, c: 5 },
            { w: 1700604800, a: 200, d: 50, c: 5 },
          ],
          'https://avatar/alice',
        ),
        makeContributorStats(
          'bob',
          5,
          [
            { w: 1700000000, a: 0, d: 0, c: 0 },
            { w: 1700604800, a: 100, d: 20, c: 5 },
          ],
          'https://avatar/bob',
        ),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');

      expect(result.contributors).toHaveLength(2);
      expect(result.contributors[0].login).toBe('alice');
      expect(result.contributors[0].totalCommits).toBe(10);
      expect(result.contributors[0].totalAdditions).toBe(700);
      expect(result.contributors[0].totalDeletions).toBe(150);
      expect(result.contributors[0].avatarUrl).toBe('https://avatar/alice');
      expect(result.contributors[0].firstCommitWeek).toBe(1700000000);
      expect(result.contributors[0].lastCommitWeek).toBe(1700604800);
    });

    it('computes correct commitPercentage with contributorStats', () => {
      const raw = emptyRaw();
      raw.commits = [];
      raw.contributorStats = [
        makeContributorStats('alice', 75, [{ w: 1, a: 0, d: 0, c: 75 }]),
        makeContributorStats('bob', 25, [{ w: 1, a: 0, d: 0, c: 25 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.contributors[0].commitPercentage).toBe(75);
      expect(result.contributors[1].commitPercentage).toBe(25);
    });

    it('handles contributorStats with no active weeks', () => {
      const raw = emptyRaw();
      raw.commits = [];
      raw.contributorStats = [
        makeContributorStats('ghost', 0, [{ w: 1700000000, a: 0, d: 0, c: 0 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.contributors[0].firstCommitWeek).toBe(0);
      expect(result.contributors[0].lastCommitWeek).toBe(0);
    });

    it('falls back to commits when contributorStats is empty array', () => {
      const raw = emptyRaw();
      raw.commits = [makeCommit('a', 'x', 'alice', '2024-01-01T00:00:00Z')];
      raw.contributorStats = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.contributors).toHaveLength(1);
      expect(result.contributors[0].login).toBe('alice');
      // Fallback path: totalAdditions = 0
      expect(result.contributors[0].totalAdditions).toBe(0);
    });
  });

  // ── computeBusFactor ──

  describe('computeBusFactor (via busFactor)', () => {
    it('returns busFactor 0 for no contributors', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.busFactor.busFactor).toBe(0);
      expect(result.busFactor.herfindahlIndex).toBe(0);
      expect(result.busFactor.cumulativeContributors).toEqual([]);
    });

    it('returns busFactor 1 for a single contributor', () => {
      const raw = emptyRaw();
      raw.commits = [makeCommit('a', 'init', 'alice', '2024-01-01T00:00:00Z')];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.busFactor.busFactor).toBe(1);
      expect(result.busFactor.herfindahlIndex).toBe(1);
      expect(result.busFactor.cumulativeContributors).toHaveLength(1);
      expect(result.busFactor.cumulativeContributors[0].cumulativePercentage).toBe(100);
    });

    it('returns busFactor 1 when one contributor dominates', () => {
      const raw = emptyRaw();
      raw.contributorStats = [
        makeContributorStats('alice', 90, [{ w: 1, a: 100, d: 0, c: 90 }]),
        makeContributorStats('bob', 10, [{ w: 1, a: 10, d: 0, c: 10 }]),
      ];
      raw.commits = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.busFactor.busFactor).toBe(1);
    });

    it('returns busFactor > 1 for balanced contributors', () => {
      const raw = emptyRaw();
      raw.contributorStats = [
        makeContributorStats('alice', 30, [{ w: 1, a: 100, d: 0, c: 30 }]),
        makeContributorStats('bob', 30, [{ w: 1, a: 100, d: 0, c: 30 }]),
        makeContributorStats('carol', 30, [{ w: 1, a: 100, d: 0, c: 30 }]),
        makeContributorStats('dave', 10, [{ w: 1, a: 10, d: 0, c: 10 }]),
      ];
      raw.commits = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.busFactor.busFactor).toBe(2);
    });

    it('includes all contributors in cumulativeContributors', () => {
      const raw = emptyRaw();
      raw.contributorStats = [
        makeContributorStats('alice', 60, [{ w: 1, a: 0, d: 0, c: 60 }]),
        makeContributorStats('bob', 30, [{ w: 1, a: 0, d: 0, c: 30 }]),
        makeContributorStats('carol', 10, [{ w: 1, a: 0, d: 0, c: 10 }]),
      ];
      raw.commits = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.busFactor.cumulativeContributors).toHaveLength(3);
      const last = result.busFactor.cumulativeContributors[2];
      expect(last.cumulativePercentage).toBe(100);
    });

    it('computes correct Herfindahl index', () => {
      const raw = emptyRaw();
      // Two equally contributing developers: HHI = 0.25 + 0.25 = 0.5
      raw.contributorStats = [
        makeContributorStats('alice', 50, [{ w: 1, a: 0, d: 0, c: 50 }]),
        makeContributorStats('bob', 50, [{ w: 1, a: 0, d: 0, c: 50 }]),
      ];
      raw.commits = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.busFactor.herfindahlIndex).toBeCloseTo(0.5, 5);
    });
  });

  // ── buildFileChurn ──

  describe('buildFileChurn (via fileChurn)', () => {
    it('returns empty array for no commit details', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.fileChurn).toEqual([]);
    });

    it('returns single file entry', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 10, 5, [{ filename: 'src/main.ts', additions: 10, deletions: 5 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileChurn).toHaveLength(1);
      expect(result.fileChurn[0]).toEqual({
        filename: 'src/main.ts',
        changeCount: 1,
        totalAdditions: 10,
        totalDeletions: 5,
        contributors: ['alice'],
      });
    });

    it('accumulates changes across multiple commits for the same file', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 10, 5, [{ filename: 'file.ts', additions: 10, deletions: 5 }]),
        makeDetail('b', 'alice', 20, 3, [{ filename: 'file.ts', additions: 20, deletions: 3 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileChurn).toHaveLength(1);
      expect(result.fileChurn[0].changeCount).toBe(2);
      expect(result.fileChurn[0].totalAdditions).toBe(30);
      expect(result.fileChurn[0].totalDeletions).toBe(8);
      expect(result.fileChurn[0].contributors).toEqual(['alice']);
    });

    it('tracks multiple contributors on the same file', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 10, 0, [{ filename: 'shared.ts', additions: 10, deletions: 0 }]),
        makeDetail('b', 'bob', 5, 1, [{ filename: 'shared.ts', additions: 5, deletions: 1 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileChurn[0].contributors).toEqual(['alice', 'bob']);
    });

    it('does not duplicate same contributor on same file', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 10, 0, [{ filename: 'f.ts', additions: 10, deletions: 0 }]),
        makeDetail('b', 'alice', 5, 0, [{ filename: 'f.ts', additions: 5, deletions: 0 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileChurn[0].contributors).toEqual(['alice']);
    });

    it('sorts by changeCount descending', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 1, 0, [{ filename: 'rarely.ts', additions: 1, deletions: 0 }]),
        makeDetail('b', 'alice', 1, 0, [{ filename: 'often.ts', additions: 1, deletions: 0 }]),
        makeDetail('c', 'alice', 1, 0, [{ filename: 'often.ts', additions: 1, deletions: 0 }]),
        makeDetail('d', 'alice', 1, 0, [{ filename: 'often.ts', additions: 1, deletions: 0 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileChurn[0].filename).toBe('often.ts');
      expect(result.fileChurn[0].changeCount).toBe(3);
    });

    it('skips commitDetails without files', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        {
          sha: 'a',
          commit: {
            message: '',
            author: { name: 'alice', email: 'a@t.com', date: '2024-01-01T00:00:00Z' },
          },
          author: { login: 'alice' },
          stats: { total: 0, additions: 0, deletions: 0 },
          // no files property
        },
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileChurn).toEqual([]);
    });

    it('uses commit.author.name when author.login is missing', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        {
          sha: 'a',
          commit: {
            message: '',
            author: { name: 'Name Only', email: 'n@t.com', date: '2024-01-01T00:00:00Z' },
          },
          author: null,
          stats: { total: 5, additions: 5, deletions: 0 },
          files: [
            {
              sha: 'x',
              filename: 'f.ts',
              status: 'modified',
              additions: 5,
              deletions: 0,
              changes: 5,
            },
          ],
        },
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileChurn[0].contributors).toEqual(['Name Only']);
    });
  });

  // ── analyzeCommitMessages ──

  describe('analyzeCommitMessages (via commitMessages)', () => {
    it('returns zeroed stats for empty commits', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.commitMessages.totalCommits).toBe(0);
      expect(result.commitMessages.averageLength).toBe(0);
      expect(result.commitMessages.medianLength).toBe(0);
      expect(result.commitMessages.mergeCommitCount).toBe(0);
      expect(result.commitMessages.conventionalPercentage).toBe(0);
      expect(result.commitMessages.wordFrequency).toEqual([]);
      expect(result.commitMessages.conventionalCommits.feat).toBe(0);
    });

    it('computes correct averageLength and medianLength', () => {
      const raw = emptyRaw();
      // Message lengths: 3, 5, 7 => avg = 5, median = 5
      raw.commits = [
        makeCommit('a', 'abc', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'abcde', 'alice', '2024-01-02T00:00:00Z'),
        makeCommit('c', 'abcdefg', 'alice', '2024-01-03T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitMessages.averageLength).toBe(5);
      expect(result.commitMessages.medianLength).toBe(5);
    });

    it('counts merge commits starting with "Merge "', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'Merge branch main into dev', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'Merge pull request #42', 'alice', '2024-01-02T00:00:00Z'),
        makeCommit('c', 'Regular commit', 'alice', '2024-01-03T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitMessages.mergeCommitCount).toBe(2);
    });

    it('detects conventional commit types (feat, fix, docs, etc.)', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'feat: add login page', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'fix: resolve crash on startup', 'alice', '2024-01-02T00:00:00Z'),
        makeCommit('c', 'docs: update README', 'alice', '2024-01-03T00:00:00Z'),
        makeCommit('d', 'style: format code', 'alice', '2024-01-04T00:00:00Z'),
        makeCommit('e', 'refactor: extract helper', 'alice', '2024-01-05T00:00:00Z'),
        makeCommit('f', 'test: add unit tests', 'alice', '2024-01-06T00:00:00Z'),
        makeCommit('g', 'chore: bump deps', 'alice', '2024-01-07T00:00:00Z'),
        makeCommit('h', 'ci: add github actions', 'alice', '2024-01-08T00:00:00Z'),
        makeCommit('i', 'perf: optimize queries', 'alice', '2024-01-09T00:00:00Z'),
        makeCommit('j', 'build: update webpack', 'alice', '2024-01-10T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitMessages.conventionalCommits.feat).toBe(1);
      expect(result.commitMessages.conventionalCommits.fix).toBe(1);
      expect(result.commitMessages.conventionalCommits.docs).toBe(1);
      expect(result.commitMessages.conventionalCommits.style).toBe(1);
      expect(result.commitMessages.conventionalCommits.refactor).toBe(1);
      expect(result.commitMessages.conventionalCommits.test).toBe(1);
      expect(result.commitMessages.conventionalCommits.chore).toBe(1);
      expect(result.commitMessages.conventionalCommits.ci).toBe(1);
      expect(result.commitMessages.conventionalCommits.perf).toBe(1);
      expect(result.commitMessages.conventionalCommits.build).toBe(1);
      expect(result.commitMessages.conventionalPercentage).toBe(100);
    });

    it('categorizes unknown conventional types as "other"', () => {
      const raw = emptyRaw();
      raw.commits = [makeCommit('a', 'wip: half done', 'alice', '2024-01-01T00:00:00Z')];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitMessages.conventionalCommits.other).toBe(1);
      expect(result.commitMessages.conventionalPercentage).toBe(100);
    });

    it('handles conventional commits with scope (e.g. feat(auth): ...)', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'feat(auth): add oauth flow', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'fix(ui)!: breaking layout change', 'alice', '2024-01-02T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitMessages.conventionalCommits.feat).toBe(1);
      expect(result.commitMessages.conventionalCommits.fix).toBe(1);
    });

    it('computes word frequency filtering stopwords and short words', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'update dashboard component', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'fix dashboard rendering bug', 'alice', '2024-01-02T00:00:00Z'),
        makeCommit('c', 'refactor: dashboard styles for the app', 'alice', '2024-01-03T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      const dashboardEntry = result.commitMessages.wordFrequency.find(
        (w) => w.word === 'dashboard',
      );
      expect(dashboardEntry).toBeDefined();
      expect(dashboardEntry!.count).toBe(3);
      // "the" is a stopword and should be filtered
      const theEntry = result.commitMessages.wordFrequency.find((w) => w.word === 'the');
      expect(theEntry).toBeUndefined();
    });

    it('filters words with 2 or fewer characters', () => {
      const raw = emptyRaw();
      raw.commits = [makeCommit('a', 'do it on go', 'alice', '2024-01-01T00:00:00Z')];
      const result = analyzeGitStats(raw, 'o', 'r');
      // "do", "it", "on", "go" all <= 2 chars
      expect(result.commitMessages.wordFrequency).toEqual([]);
    });

    it('strips conventional commit prefix before word frequency analysis', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'feat: implement authentication', 'alice', '2024-01-01T00:00:00Z'),
        makeCommit('b', 'fix(auth): implement login flow', 'alice', '2024-01-02T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      const implementEntry = result.commitMessages.wordFrequency.find(
        (w) => w.word === 'implement',
      );
      expect(implementEntry).toBeDefined();
      expect(implementEntry!.count).toBe(2);
      // "feat" should not appear in word frequency because it's part of the prefix
      const featEntry = result.commitMessages.wordFrequency.find((w) => w.word === 'feat');
      expect(featEntry).toBeUndefined();
    });

    it('uses only the first line of multi-line messages', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit(
          'a',
          'fix: header alignment\n\nDetails about the second line content hidden here',
          'alice',
          '2024-01-01T00:00:00Z',
        ),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      const hiddenEntry = result.commitMessages.wordFrequency.find((w) => w.word === 'hidden');
      expect(hiddenEntry).toBeUndefined();
      const headerEntry = result.commitMessages.wordFrequency.find((w) => w.word === 'header');
      expect(headerEntry).toBeDefined();
    });
  });

  // ── buildCommitSizeDistribution ──

  describe('buildCommitSizeDistribution (via commitSizeDistribution)', () => {
    it('returns 7 buckets all at 0 for no commit details', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.commitSizeDistribution.buckets).toHaveLength(7);
      for (const bucket of result.commitSizeDistribution.buckets) {
        expect(bucket.count).toBe(0);
      }
    });

    it('places a 0-line commit in the "0" bucket', () => {
      const raw = emptyRaw();
      raw.commitDetails = [makeDetail('a', 'alice', 0, 0)];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitSizeDistribution.buckets[0].label).toBe('0');
      expect(result.commitSizeDistribution.buckets[0].count).toBe(1);
    });

    it('places a 5-line commit in the "1-10" bucket', () => {
      const raw = emptyRaw();
      raw.commitDetails = [makeDetail('a', 'alice', 3, 2)];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitSizeDistribution.buckets[1].label).toBe('1-10');
      expect(result.commitSizeDistribution.buckets[1].count).toBe(1);
    });

    it('distributes commits across multiple buckets', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 0, 0), // 0
        makeDetail('b', 'alice', 5, 0), // 1-10
        makeDetail('c', 'alice', 25, 5), // 11-50
        makeDetail('d', 'alice', 60, 15), // 51-100
        makeDetail('e', 'alice', 300, 50), // 101-500
        makeDetail('f', 'alice', 500, 250), // 501-1000
        makeDetail('g', 'alice', 1000, 500), // 1000+
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitSizeDistribution.buckets[0].count).toBe(1); // 0
      expect(result.commitSizeDistribution.buckets[1].count).toBe(1); // 1-10
      expect(result.commitSizeDistribution.buckets[2].count).toBe(1); // 11-50
      expect(result.commitSizeDistribution.buckets[3].count).toBe(1); // 51-100
      expect(result.commitSizeDistribution.buckets[4].count).toBe(1); // 101-500
      expect(result.commitSizeDistribution.buckets[5].count).toBe(1); // 501-1000
      expect(result.commitSizeDistribution.buckets[6].count).toBe(1); // 1000+
    });

    it('places boundary value 10 in "1-10" bucket', () => {
      const raw = emptyRaw();
      raw.commitDetails = [makeDetail('a', 'alice', 10, 0)];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitSizeDistribution.buckets[1].count).toBe(1);
    });

    it('places boundary value 11 in "11-50" bucket', () => {
      const raw = emptyRaw();
      raw.commitDetails = [makeDetail('a', 'alice', 11, 0)];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitSizeDistribution.buckets[2].count).toBe(1);
    });
  });

  // ── buildRepoGrowth ──

  describe('buildRepoGrowth (via repoGrowth)', () => {
    it('returns empty array when codeFrequency is null', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.repoGrowth).toEqual([]);
    });

    it('returns empty array when codeFrequency is empty', () => {
      const raw = emptyRaw();
      raw.codeFrequency = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.repoGrowth).toEqual([]);
    });

    it('computes cumulative additions/deletions and netGrowth', () => {
      const raw = emptyRaw();
      // 2024-01-01 00:00:00 UTC = 1704067200
      raw.codeFrequency = [
        [1704067200, 100, -30],
        [1704672000, 50, -10],
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.repoGrowth).toHaveLength(2);

      expect(result.repoGrowth[0].cumulativeAdditions).toBe(100);
      expect(result.repoGrowth[0].cumulativeDeletions).toBe(30);
      expect(result.repoGrowth[0].netGrowth).toBe(70);

      expect(result.repoGrowth[1].cumulativeAdditions).toBe(150);
      expect(result.repoGrowth[1].cumulativeDeletions).toBe(40);
      expect(result.repoGrowth[1].netGrowth).toBe(110);
    });

    it('converts timestamps to ISO date strings', () => {
      const raw = emptyRaw();
      // 1704067200 = 2024-01-01T00:00:00Z
      raw.codeFrequency = [[1704067200, 10, -5]];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.repoGrowth[0].date).toBe('2024-01-01');
    });
  });

  // ── buildPunchCard ──

  describe('buildPunchCard (via punchCard)', () => {
    it('returns empty array when punchCard is null', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.punchCard).toEqual([]);
    });

    it('returns empty array when punchCard is empty', () => {
      const raw = emptyRaw();
      raw.punchCard = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.punchCard).toEqual([]);
    });

    it('maps punchCard tuples to objects with day, hour, commits', () => {
      const raw = emptyRaw();
      raw.punchCard = [
        [0, 9, 5],
        [1, 14, 10],
        [6, 22, 2],
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.punchCard).toHaveLength(3);
      expect(result.punchCard[0]).toEqual({ day: 0, hour: 9, commits: 5 });
      expect(result.punchCard[1]).toEqual({ day: 1, hour: 14, commits: 10 });
      expect(result.punchCard[2]).toEqual({ day: 6, hour: 22, commits: 2 });
    });
  });

  // ── buildWeeklyActivity ──

  describe('buildWeeklyActivity (via weeklyActivity)', () => {
    it('returns empty array when commitActivity is null', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.weeklyActivity).toEqual([]);
    });

    it('returns empty array when commitActivity is empty', () => {
      const raw = emptyRaw();
      raw.commitActivity = [];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.weeklyActivity).toEqual([]);
    });

    it('maps commitActivity to WeeklyActivity with weekStart date and day counts', () => {
      const raw = emptyRaw();
      // 1704067200 = 2024-01-01T00:00:00Z
      raw.commitActivity = [{ week: 1704067200, total: 15, days: [0, 3, 5, 2, 4, 1, 0] }];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.weeklyActivity).toHaveLength(1);
      expect(result.weeklyActivity[0].weekStart).toBe('2024-01-01');
      expect(result.weeklyActivity[0].total).toBe(15);
      expect(result.weeklyActivity[0].days).toEqual([0, 3, 5, 2, 4, 1, 0]);
    });
  });

  // ── buildLanguageBreakdown ──

  describe('buildLanguageBreakdown (via languages)', () => {
    it('returns empty array when languages is null', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.languages).toEqual([]);
    });

    it('returns empty array when all languages have 0 bytes', () => {
      const raw = emptyRaw();
      raw.languages = { TypeScript: 0, JavaScript: 0 };
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.languages).toEqual([]);
    });

    it('computes correct percentages', () => {
      const raw = emptyRaw();
      raw.languages = { TypeScript: 7000, JavaScript: 3000 };
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.languages).toHaveLength(2);
      expect(result.languages[0].name).toBe('TypeScript');
      expect(result.languages[0].bytes).toBe(7000);
      expect(result.languages[0].percentage).toBe(70);
      expect(result.languages[1].name).toBe('JavaScript');
      expect(result.languages[1].percentage).toBe(30);
    });

    it('sorts by bytes descending', () => {
      const raw = emptyRaw();
      raw.languages = { CSS: 100, TypeScript: 1000, HTML: 500 };
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.languages[0].name).toBe('TypeScript');
      expect(result.languages[1].name).toBe('HTML');
      expect(result.languages[2].name).toBe('CSS');
    });

    it('rounds percentages to one decimal place', () => {
      const raw = emptyRaw();
      // 3333 / 10000 = 33.33%
      raw.languages = { A: 3333, B: 6667 };
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.languages[0].percentage).toBe(66.7);
      expect(result.languages[1].percentage).toBe(33.3);
    });
  });

  // ── buildCommitsByWeekday ──

  describe('buildCommitsByWeekday (via commitsByWeekday)', () => {
    it('returns a 7-element array of zeros for no commits', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.commitsByWeekday).toHaveLength(7);
      expect(result.commitsByWeekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
    });

    it('maps commits to the correct weekday indices (Sun=0 .. Sat=6)', () => {
      const raw = emptyRaw();
      // 2024-01-01 is Monday (day=1), 2024-01-07 is Sunday (day=0)
      raw.commits = [
        makeCommit('a', 'mon', 'alice', '2024-01-01T12:00:00Z'),
        makeCommit('b', 'sun', 'alice', '2024-01-07T12:00:00Z'),
        makeCommit('c', 'sat', 'alice', '2024-01-06T12:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitsByWeekday[0]).toBe(1); // Sunday
      expect(result.commitsByWeekday[1]).toBe(1); // Monday
      expect(result.commitsByWeekday[6]).toBe(1); // Saturday
    });
  });

  // ── buildCommitsByMonth ──

  describe('buildCommitsByMonth (via commitsByMonth)', () => {
    it('returns a 12-element array of zeros for no commits', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.commitsByMonth).toHaveLength(12);
      expect(result.commitsByMonth).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('assigns commits to correct month indices (Jan=0, Dec=11)', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'jan', 'alice', '2024-01-15T00:00:00Z'),
        makeCommit('b', 'jun', 'alice', '2024-06-15T00:00:00Z'),
        makeCommit('c', 'dec', 'alice', '2024-12-15T00:00:00Z'),
        makeCommit('d', 'jan2', 'alice', '2023-01-10T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitsByMonth[0]).toBe(2); // January
      expect(result.commitsByMonth[5]).toBe(1); // June
      expect(result.commitsByMonth[11]).toBe(1); // December
    });
  });

  // ── buildCommitsByYear ──

  describe('buildCommitsByYear (via commitsByYear)', () => {
    it('returns empty array for no commits', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.commitsByYear).toEqual([]);
    });

    it('groups commits by year and sorts ascending', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'x', 'alice', '2022-03-15T00:00:00Z'),
        makeCommit('b', 'x', 'alice', '2024-06-15T00:00:00Z'),
        makeCommit('c', 'x', 'alice', '2024-12-15T00:00:00Z'),
        makeCommit('d', 'x', 'alice', '2023-01-10T00:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitsByYear).toEqual([
        { year: 2022, count: 1 },
        { year: 2023, count: 1 },
        { year: 2024, count: 2 },
      ]);
    });
  });

  // ── buildCommitsByExtension ──

  describe('buildCommitsByExtension (via commitsByExtension)', () => {
    it('returns empty array for no commit details', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.commitsByExtension).toEqual([]);
    });

    it('extracts extensions from filenames', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 10, 0, [
          { filename: 'src/main.ts', additions: 5, deletions: 0 },
          { filename: 'src/style.css', additions: 5, deletions: 0 },
        ]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      const tsEntry = result.commitsByExtension.find((e) => e.ext === '.ts');
      const cssEntry = result.commitsByExtension.find((e) => e.ext === '.css');
      expect(tsEntry).toBeDefined();
      expect(cssEntry).toBeDefined();
      expect(tsEntry!.count).toBe(1);
      expect(cssEntry!.count).toBe(1);
    });

    it('uses "(no ext)" for extensionless files', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 5, 0, [{ filename: 'Makefile', additions: 5, deletions: 0 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitsByExtension[0].ext).toBe('(no ext)');
    });

    it('counts each extension only once per commit (deduplication)', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 10, 0, [
          { filename: 'a.ts', additions: 5, deletions: 0 },
          { filename: 'b.ts', additions: 5, deletions: 0 },
        ]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      const tsEntry = result.commitsByExtension.find((e) => e.ext === '.ts');
      // Should be 1 (one commit touched .ts), not 2
      expect(tsEntry!.count).toBe(1);
    });

    it('sorts by count descending', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 5, 0, [{ filename: 'a.ts', additions: 5, deletions: 0 }]),
        makeDetail('b', 'alice', 5, 0, [{ filename: 'b.ts', additions: 5, deletions: 0 }]),
        makeDetail('c', 'alice', 5, 0, [{ filename: 'c.css', additions: 5, deletions: 0 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.commitsByExtension[0].ext).toBe('.ts');
      expect(result.commitsByExtension[0].count).toBe(2);
      expect(result.commitsByExtension[1].ext).toBe('.css');
      expect(result.commitsByExtension[1].count).toBe(1);
    });
  });

  // ── buildLinesByExtension ──

  describe('buildLinesByExtension (via linesByExtension)', () => {
    it('returns empty array for no commit details', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.linesByExtension).toEqual([]);
    });

    it('accumulates additions and deletions per extension', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 30, 10, [
          { filename: 'a.ts', additions: 20, deletions: 5 },
          { filename: 'b.ts', additions: 10, deletions: 5 },
        ]),
        makeDetail('b', 'alice', 15, 3, [{ filename: 'c.ts', additions: 15, deletions: 3 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      const tsEntry = result.linesByExtension.find((e) => e.ext === '.ts');
      expect(tsEntry!.additions).toBe(45);
      expect(tsEntry!.deletions).toBe(13);
    });

    it('sorts by total lines (additions + deletions) descending', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 100, 10, [
          { filename: 'a.ts', additions: 100, deletions: 10 },
          { filename: 'b.css', additions: 5, deletions: 2 },
        ]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.linesByExtension[0].ext).toBe('.ts');
      expect(result.linesByExtension[1].ext).toBe('.css');
    });

    it('uses "(no ext)" for files without extensions', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 10, 0, [{ filename: 'Dockerfile', additions: 10, deletions: 0 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.linesByExtension[0].ext).toBe('(no ext)');
    });
  });

  // ── buildFileCoupling ──

  describe('buildFileCoupling (via fileCoupling)', () => {
    it('returns empty array for no commit details', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.fileCoupling).toEqual([]);
    });

    it('returns empty array when no pair reaches 3 co-changes', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 5, 0, [
          { filename: 'x.ts', additions: 3, deletions: 0 },
          { filename: 'y.ts', additions: 2, deletions: 0 },
        ]),
        makeDetail('b', 'alice', 5, 0, [
          { filename: 'x.ts', additions: 3, deletions: 0 },
          { filename: 'y.ts', additions: 2, deletions: 0 },
        ]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      // Only 2 co-changes for x.ts/y.ts, needs >= 3
      expect(result.fileCoupling).toEqual([]);
    });

    it('detects file pairs with >= 3 co-changes', () => {
      const raw = emptyRaw();
      const files = [
        { filename: 'a.ts', additions: 1, deletions: 0 },
        { filename: 'b.ts', additions: 1, deletions: 0 },
      ];
      raw.commitDetails = [
        makeDetail('1', 'alice', 2, 0, files),
        makeDetail('2', 'alice', 2, 0, files),
        makeDetail('3', 'alice', 2, 0, files),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileCoupling).toHaveLength(1);
      expect(result.fileCoupling[0].cochanges).toBe(3);
      expect(result.fileCoupling[0].file1).toBe('a.ts');
      expect(result.fileCoupling[0].file2).toBe('b.ts');
    });

    it('skips commits with more than 50 files', () => {
      const raw = emptyRaw();
      const manyFiles = Array.from({ length: 51 }, (_, i) => ({
        filename: `file${i}.ts`,
        additions: 1,
        deletions: 0,
      }));
      raw.commitDetails = [
        makeDetail('a', 'alice', 51, 0, manyFiles),
        makeDetail('b', 'alice', 51, 0, manyFiles),
        makeDetail('c', 'alice', 51, 0, manyFiles),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileCoupling).toEqual([]);
    });

    it('skips commits with fewer than 2 files', () => {
      const raw = emptyRaw();
      raw.commitDetails = [
        makeDetail('a', 'alice', 1, 0, [{ filename: 'solo.ts', additions: 1, deletions: 0 }]),
        makeDetail('b', 'alice', 1, 0, [{ filename: 'solo.ts', additions: 1, deletions: 0 }]),
        makeDetail('c', 'alice', 1, 0, [{ filename: 'solo.ts', additions: 1, deletions: 0 }]),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.fileCoupling).toEqual([]);
    });

    it('limits file pairs to first 20 files per commit', () => {
      const raw = emptyRaw();
      // 25 files (under 50 limit) but only first 20 should be considered for pairing
      const files = Array.from({ length: 25 }, (_, i) => ({
        filename: `file${String(i).padStart(2, '0')}.ts`,
        additions: 1,
        deletions: 0,
      }));
      raw.commitDetails = [
        makeDetail('a', 'alice', 25, 0, files),
        makeDetail('b', 'alice', 25, 0, files),
        makeDetail('c', 'alice', 25, 0, files),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      // file20.ts through file24.ts should not appear in any coupling pairs
      for (const pair of result.fileCoupling) {
        expect(pair.file1 < 'file20.ts' || pair.file2 < 'file20.ts').toBe(true);
      }
    });

    it('sorts coupled pairs by cochanges descending', () => {
      const raw = emptyRaw();
      const pairAB = [
        { filename: 'a.ts', additions: 1, deletions: 0 },
        { filename: 'b.ts', additions: 1, deletions: 0 },
      ];
      const pairCD = [
        { filename: 'c.ts', additions: 1, deletions: 0 },
        { filename: 'd.ts', additions: 1, deletions: 0 },
      ];
      raw.commitDetails = [
        makeDetail('1', 'alice', 2, 0, pairAB),
        makeDetail('2', 'alice', 2, 0, pairAB),
        makeDetail('3', 'alice', 2, 0, pairAB),
        makeDetail('4', 'alice', 2, 0, [...pairAB, ...pairCD]),
        makeDetail('5', 'alice', 2, 0, pairCD),
        makeDetail('6', 'alice', 2, 0, pairCD),
        makeDetail('7', 'alice', 2, 0, pairCD),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      // a.ts/b.ts = 4 co-changes, c.ts/d.ts = 4 co-changes, a.ts/c.ts = 1, etc.
      expect(result.fileCoupling.length).toBeGreaterThanOrEqual(2);
      // Both top pairs should have 4 co-changes
      expect(result.fileCoupling[0].cochanges).toBeGreaterThanOrEqual(
        result.fileCoupling[1].cochanges,
      );
    });
  });

  // ── computeFirstCommitDate ──

  describe('computeFirstCommitDate (via firstCommitDate)', () => {
    it('returns empty string for no commits', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.firstCommitDate).toBe('');
    });

    it('finds the earliest commit date among all commits', () => {
      const raw = emptyRaw();
      raw.commits = [
        makeCommit('a', 'recent', 'alice', '2024-06-15T10:00:00Z'),
        makeCommit('b', 'oldest', 'bob', '2022-01-01T00:00:00Z'),
        makeCommit('c', 'middle', 'carol', '2023-03-10T05:00:00Z'),
      ];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.firstCommitDate).toBe('2022-01-01T00:00:00.000Z');
    });

    it('handles a single commit correctly', () => {
      const raw = emptyRaw();
      raw.commits = [makeCommit('a', 'only', 'alice', '2024-05-20T12:30:00Z')];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.firstCommitDate).toBe('2024-05-20T12:30:00.000Z');
    });
  });

  // ── computeRepoAgeDays ──

  describe('computeRepoAgeDays (via repoAgeDays)', () => {
    it('returns 0 for no commits (empty firstCommitDate)', () => {
      const result = analyzeGitStats(emptyRaw(), 'o', 'r');
      expect(result.repoAgeDays).toBe(0);
    });

    it('calculates days from first commit to now', () => {
      const raw = emptyRaw();
      const now = Date.now();
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
      raw.commits = [makeCommit('a', 'init', 'alice', tenDaysAgo)];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.repoAgeDays).toBe(10);
    });

    it('returns positive number for an old commit', () => {
      const raw = emptyRaw();
      raw.commits = [makeCommit('a', 'old', 'alice', '2020-01-01T00:00:00Z')];
      const result = analyzeGitStats(raw, 'o', 'r');
      expect(result.repoAgeDays).toBeGreaterThan(365);
    });
  });

  // ── Edge cases / integration ──

  describe('integration edge cases', () => {
    it('handles a complete raw data object with all optional fields populated', () => {
      const raw: GitStatsRawData = {
        commits: [
          makeCommit(
            'a',
            'feat: initial commit',
            'alice',
            '2024-01-01T00:00:00Z',
            'https://avatar/alice',
          ),
          makeCommit('b', 'fix: bug fix', 'bob', '2024-01-02T00:00:00Z', 'https://avatar/bob'),
        ],
        commitDetails: [
          makeDetail('a', 'alice', 50, 10, [
            { filename: 'src/index.ts', additions: 40, deletions: 5 },
            { filename: 'package.json', additions: 10, deletions: 5 },
          ]),
          makeDetail('b', 'bob', 5, 2, [
            { filename: 'src/index.ts', additions: 3, deletions: 1 },
            { filename: 'README.md', additions: 2, deletions: 1 },
          ]),
        ],
        contributorStats: [
          makeContributorStats(
            'alice',
            8,
            [{ w: 1704067200, a: 200, d: 50, c: 8 }],
            'https://avatar/alice',
          ),
          makeContributorStats(
            'bob',
            2,
            [{ w: 1704067200, a: 20, d: 5, c: 2 }],
            'https://avatar/bob',
          ),
        ],
        codeFrequency: [[1704067200, 100, -20]],
        commitActivity: [{ week: 1704067200, total: 10, days: [1, 2, 2, 2, 2, 1, 0] }],
        participation: { all: new Array(52).fill(5), owner: new Array(52).fill(3) },
        punchCard: [[1, 10, 5]],
        languages: { TypeScript: 5000, JSON: 500 },
        totalLinesOfCode: 5500,
        binaryFileCount: 2,
      };

      const result = analyzeGitStats(raw, 'test-org', 'test-repo');

      expect(result.owner).toBe('test-org');
      expect(result.repo).toBe('test-repo');
      expect(result.totalCommits).toBe(2);
      expect(result.totalLinesOfCode).toBe(5500);
      expect(result.binaryFileCount).toBe(2);
      expect(result.contributors).toHaveLength(2);
      expect(result.busFactor.busFactor).toBeGreaterThanOrEqual(1);
      expect(result.fileChurn.length).toBeGreaterThan(0);
      expect(result.commitMessages.totalCommits).toBe(2);
      expect(result.commitSizeDistribution.buckets).toHaveLength(7);
      expect(result.repoGrowth).toHaveLength(1);
      expect(result.punchCard).toHaveLength(1);
      expect(result.weeklyActivity).toHaveLength(1);
      expect(result.languages).toHaveLength(2);
      expect(result.commitsByWeekday).toHaveLength(7);
      expect(result.commitsByMonth).toHaveLength(12);
      expect(result.commitsByYear.length).toBeGreaterThan(0);
      expect(result.firstCommitDate).toBeTruthy();
      expect(result.repoAgeDays).toBeGreaterThan(0);
    });

    it('handles a minimal raw data object with all optionals null/missing', () => {
      const result = analyzeGitStats(emptyRaw(), 'empty-org', 'empty-repo');

      expect(result.owner).toBe('empty-org');
      expect(result.repo).toBe('empty-repo');
      expect(result.totalCommits).toBe(0);
      expect(result.totalLinesOfCode).toBe(0);
      expect(result.binaryFileCount).toBe(0);
      expect(result.contributors).toEqual([]);
      expect(result.busFactor).toEqual({
        busFactor: 0,
        herfindahlIndex: 0,
        cumulativeContributors: [],
      });
      expect(result.fileChurn).toEqual([]);
      expect(result.commitMessages.totalCommits).toBe(0);
      expect(result.repoGrowth).toEqual([]);
      expect(result.punchCard).toEqual([]);
      expect(result.weeklyActivity).toEqual([]);
      expect(result.languages).toEqual([]);
      expect(result.commitsByWeekday).toEqual([0, 0, 0, 0, 0, 0, 0]);
      expect(result.commitsByMonth).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(result.commitsByYear).toEqual([]);
      expect(result.commitsByExtension).toEqual([]);
      expect(result.linesByExtension).toEqual([]);
      expect(result.fileCoupling).toEqual([]);
      expect(result.firstCommitDate).toBe('');
      expect(result.repoAgeDays).toBe(0);
    });
  });
});

/**
 * End-to-end tests for diffCommit / diffCommitFast against a real git repo.
 * Creates a temporary repo with Node's fs, hand-crafts a few commits, and
 * verifies the diff output. This guards against the regression where the
 * diffs either timed out or missed changes due to broken subtree pruning.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import git from 'isomorphic-git';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { diffCommit, diffCommitFast, createDiffCache } from '../extractors';

let dir: string;
const commits: { sha: string; parent: string | null; label: string }[] = [];

async function commit(label: string, author = 'Tester'): Promise<string> {
  return git.commit({
    fs,
    dir,
    message: label,
    author: { name: author, email: `${author.toLowerCase()}@test.local` },
  });
}

async function writeAndAdd(rel: string, content: string): Promise<void> {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  await git.add({ fs, dir, filepath: rel });
}

async function remove(rel: string): Promise<void> {
  fs.unlinkSync(path.join(dir, rel));
  await git.remove({ fs, dir, filepath: rel });
}

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoguru-difftest-'));
  await git.init({ fs, dir, defaultBranch: 'main' });

  // c1: initial — several files, multi-level directory so we can verify
  //     that subtree pruning doesn't skip real changes.
  await writeAndAdd('README.md', 'hello\nworld\n');
  await writeAndAdd('src/index.ts', 'export const x = 1;\n');
  await writeAndAdd('src/util/a.ts', 'export const a = 1;\n');
  await writeAndAdd('src/util/b.ts', 'export const b = 2;\n');
  await writeAndAdd('docs/intro.md', 'intro\n');
  const c1 = await commit('c1: initial');
  commits.push({ sha: c1, parent: null, label: 'c1' });

  // c2: modify ONE deep file — rest of the tree unchanged.
  //     This is the pruning test — a naive walk touches every file,
  //     the fix should only read the src/util subtree.
  await writeAndAdd('src/util/a.ts', 'export const a = 42;\nexport const a2 = 2;\n');
  const c2 = await commit('c2: modify deep file');
  commits.push({ sha: c2, parent: c1, label: 'c2' });

  // c3: add a new file + delete another — different subtrees
  await writeAndAdd('src/util/c.ts', 'export const c = 3;\n');
  await remove('docs/intro.md');
  const c3 = await commit('c3: add + delete');
  commits.push({ sha: c3, parent: c2, label: 'c3' });

  // c4: rename (via add + remove) in same commit
  await writeAndAdd('src/util/renamed.ts', 'export const a = 42;\nexport const a2 = 2;\n');
  await remove('src/util/a.ts');
  const c4 = await commit('c4: rename-ish');
  commits.push({ sha: c4, parent: c3, label: 'c4' });

  // c5: identity commit (re-touch a file with no content change)
  //     Creates a new commit but the tree OID is unchanged — good
  //     cross-check for the prune path.
  await writeAndAdd('src/index.ts', 'export const x = 1;\n');
  const c5 = await commit('c5: no-op add');
  commits.push({ sha: c5, parent: c4, label: 'c5' });
});

afterAll(() => {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('diffCommit (native tree diff)', () => {
  it('returns every blob for the initial commit', async () => {
    const c1 = commits[0];
    const result = await diffCommit(fs as never, dir, c1.sha, c1.parent);
    const names = result.map((f) => f.filename).sort();
    expect(names).toEqual([
      'README.md',
      'docs/intro.md',
      'src/index.ts',
      'src/util/a.ts',
      'src/util/b.ts',
    ]);
    for (const f of result) {
      expect(f.status).toBe('added');
      expect(f.additions).toBeGreaterThan(0);
      expect(f.deletions).toBe(0);
    }
    expect(result.stats.additions).toBeGreaterThan(0);
    expect(result.stats.deletions).toBe(0);
  });

  it('reports only the deep modified file, not the unchanged siblings', async () => {
    const c2 = commits[1];
    const result = await diffCommit(fs as never, dir, c2.sha, c2.parent);
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe('src/util/a.ts');
    expect(result[0].status).toBe('modified');
    expect(result[0].additions).toBeGreaterThan(0);
  });

  it('reports adds and deletes in different subtrees', async () => {
    const c3 = commits[2];
    const result = await diffCommit(fs as never, dir, c3.sha, c3.parent);
    const byName = new Map(result.map((f) => [f.filename, f]));
    expect(byName.get('src/util/c.ts')?.status).toBe('added');
    expect(byName.get('docs/intro.md')?.status).toBe('removed');
    expect(result).toHaveLength(2);
  });

  it('reports add+remove pair for a rename-style change', async () => {
    const c4 = commits[3];
    const result = await diffCommit(fs as never, dir, c4.sha, c4.parent);
    const statuses = result.map((f) => ({ filename: f.filename, status: f.status }));
    expect(statuses).toEqual(
      expect.arrayContaining([
        { filename: 'src/util/a.ts', status: 'removed' },
        { filename: 'src/util/renamed.ts', status: 'added' },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it('returns an empty diff when a commit has the same tree as its parent', async () => {
    const c5 = commits[4];
    const result = await diffCommit(fs as never, dir, c5.sha, c5.parent);
    expect(result).toHaveLength(0);
    expect(result.stats.total).toBe(0);
  });
});

describe('diffCommitFast (native tree diff, OID-only)', () => {
  it('agrees with diffCommit on which files changed', async () => {
    for (const c of commits) {
      const full = await diffCommit(fs as never, dir, c.sha, c.parent);
      const fast = await diffCommitFast(fs as never, dir, c.sha, c.parent);
      const fullNames = full.map((f) => f.filename).sort();
      const fastNames = fast.map((f) => f.filename).sort();
      expect(fastNames).toEqual(fullNames);
    }
  });

  it('uses 1/1 placeholder line counts (never reads blobs)', async () => {
    const c2 = commits[1];
    const result = await diffCommitFast(fs as never, dir, c2.sha, c2.parent);
    expect(result).toHaveLength(1);
    const file = result[0];
    // Modified blob: should be 1 addition + 1 deletion placeholder
    expect(file.additions).toBe(1);
    expect(file.deletions).toBe(1);
  });

  it('handles initial commits without a parent', async () => {
    const c1 = commits[0];
    const result = await diffCommitFast(fs as never, dir, c1.sha, null);
    expect(result.length).toBe(5);
    for (const f of result) {
      expect(f.status).toBe('added');
      expect(f.additions).toBe(1);
      expect(f.deletions).toBe(0);
    }
  });
});

describe('shared cache across commits', () => {
  it('produces identical results when one cache is reused for every call', async () => {
    // Running every commit through a single shared cache should give byte-
    // for-byte identical output to running each with a fresh cache. This is
    // the hot path in git.worker.ts — regression-proofs that cache reuse
    // never leaks state between commits.
    const sharedCache = createDiffCache();

    for (const c of commits) {
      const fresh = await diffCommit(fs as never, dir, c.sha, c.parent);
      const shared = await diffCommit(fs as never, dir, c.sha, c.parent, sharedCache);
      expect(shared.map((f) => f.filename).sort()).toEqual(fresh.map((f) => f.filename).sort());
      expect(shared.stats).toEqual(fresh.stats);
    }

    // Run the same sequence again — every call should now be a pure cache
    // hit for tree reads and still produce identical results.
    for (const c of commits) {
      const shared = await diffCommitFast(fs as never, dir, c.sha, c.parent, sharedCache);
      const fresh = await diffCommitFast(fs as never, dir, c.sha, c.parent);
      expect(shared.map((f) => f.filename).sort()).toEqual(fresh.map((f) => f.filename).sort());
    }
  });
});

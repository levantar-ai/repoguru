// Quick benchmark for the native-tree-diff implementation in extractors.ts.
// Runs diffCommitFast against a real repo via Node's fs (no browser needed).
//
// Run: node scripts/bench-diff.mjs [repo_path]

import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Use the TypeScript source via a loader? Too much setup. Re-implement the
// relevant bits inline to match what extractors.ts does.
const MAX_DIFF_FILES = 200;

async function listTreeAsAdded(dir, oid, prefix, out, cache) {
  if (out.length >= MAX_DIFF_FILES) return;
  const { tree } = await git.readTree({ fs, dir, oid, cache });
  for (const entry of tree) {
    if (out.length >= MAX_DIFF_FILES) return;
    const p = prefix ? `${prefix}/${entry.path}` : entry.path;
    if (entry.type === 'tree') await listTreeAsAdded(dir, entry.oid, p, out, cache);
    else if (entry.type === 'blob')
      out.push({ filename: p, status: 'added', additions: 1, deletions: 0 });
  }
}

async function listTreeAsRemoved(dir, oid, prefix, out, cache) {
  if (out.length >= MAX_DIFF_FILES) return;
  const { tree } = await git.readTree({ fs, dir, oid, cache });
  for (const entry of tree) {
    if (out.length >= MAX_DIFF_FILES) return;
    const p = prefix ? `${prefix}/${entry.path}` : entry.path;
    if (entry.type === 'tree') await listTreeAsRemoved(dir, entry.oid, p, out, cache);
    else if (entry.type === 'blob')
      out.push({ filename: p, status: 'removed', additions: 0, deletions: 1 });
  }
}

async function nativeTreeDiff(dir, oldOid, newOid, prefix, out, cache) {
  if (out.length >= MAX_DIFF_FILES) return;
  if (oldOid === newOid) return;
  const [oldTree, newTree] = await Promise.all([
    git.readTree({ fs, dir, oid: oldOid, cache }),
    git.readTree({ fs, dir, oid: newOid, cache }),
  ]);
  const oldMap = new Map(oldTree.tree.map((e) => [e.path, e]));
  const newMap = new Map(newTree.tree.map((e) => [e.path, e]));
  for (const [name, n] of newMap) {
    if (out.length >= MAX_DIFF_FILES) return;
    const o = oldMap.get(name);
    const p = prefix ? `${prefix}/${name}` : name;
    if (!o) {
      if (n.type === 'tree') await listTreeAsAdded(dir, n.oid, p, out, cache);
      else out.push({ filename: p, status: 'added' });
      continue;
    }
    if (o.oid === n.oid) continue;
    if (o.type === 'tree' && n.type === 'tree') {
      await nativeTreeDiff(dir, o.oid, n.oid, p, out, cache);
    } else if (o.type === 'blob' && n.type === 'blob') {
      out.push({ filename: p, status: 'modified' });
    }
  }
  for (const [name, o] of oldMap) {
    if (out.length >= MAX_DIFF_FILES) return;
    if (newMap.has(name)) continue;
    const p = prefix ? `${prefix}/${name}` : name;
    if (o.type === 'tree') await listTreeAsRemoved(dir, o.oid, p, out, cache);
    else out.push({ filename: p, status: 'removed' });
  }
}

async function diffCommitFastNativeFreshCache(dir, oid, parentOid) {
  return diffCommitFastNativeWithCache(dir, oid, parentOid, {});
}

async function diffCommitFastNativeWithCache(dir, oid, parentOid, cache) {
  const files = [];
  const { commit: newCommit } = await git.readCommit({ fs, dir, oid, cache });
  if (parentOid) {
    const { commit: oldCommit } = await git.readCommit({ fs, dir, oid: parentOid, cache });
    await nativeTreeDiff(dir, oldCommit.tree, newCommit.tree, '', files, cache);
  } else {
    await listTreeAsAdded(dir, newCommit.tree, '', files, cache);
  }
  return files.length;
}

// Reference: the OLD walker-based version, matching the pre-fix code exactly —
// the map callback calls a helper and only pushes on a truthy result, but
// returns `undefined` so the walker recurses into every subtree regardless.
async function diffCommitFastOldHelper(entries) {
  const [pe, ce] = entries;
  const pOid = pe ? await pe.oid() : null;
  const cOid = ce ? await ce.oid() : null;
  if (pOid === cOid) return null;
  const pT = pe ? await pe.type() : null;
  const cT = ce ? await ce.type() : null;
  if (pT === 'tree' || cT === 'tree') return null;
  return { filename: 'modified' };
}
async function diffCommitFastOld(dir, oid, parentOid) {
  const files = [];
  const trees = [git.TREE({ ref: parentOid }), git.TREE({ ref: oid })];
  await git.walk({
    fs,
    dir,
    trees,
    cache: {},
    map: async (filepath, entries) => {
      if (!entries || filepath === '.') return;
      if (files.length >= MAX_DIFF_FILES) return null;
      const result = await diffCommitFastOldHelper(entries);
      if (result) files.push({ filename: filepath, status: 'modified' });
      // implicit return undefined → walker recurses into children
    },
  });
  return files.length;
}

// ─────────────── Run ───────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = process.argv[2] || path.resolve(__dirname, '..');

const log = await git.log({ fs, dir, depth: 100 });
const pairs = log
  .filter((e) => e.commit.parent.length > 0)
  .map((e) => ({ oid: e.oid, parentOid: e.commit.parent[0] }));

console.log(`Repo: ${dir}`);
console.log(`Benchmarking ${pairs.length} commits\n`);

const runBatch = async (label, fn) => {
  const t0 = performance.now();
  const counts = [];
  for (const { oid, parentOid } of pairs) counts.push(await fn(dir, oid, parentOid));
  const t1 = performance.now();
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  console.log(
    `${label}:`.padEnd(22) +
      ` ${(t1 - t0).toFixed(0).padStart(7)}ms total, ` +
      `${((t1 - t0) / pairs.length).toFixed(1).padStart(6)}ms/commit, ` +
      `avg ${avg.toFixed(1)} changed files`,
  );
  return { ms: t1 - t0, counts };
};

// Warmup so cold-cache bias doesn't skew results
await runBatch('warmup             ', diffCommitFastOld);
const oldRun = await runBatch('OLD walk (no prune)', diffCommitFastOld);
const nativeRun = await runBatch('NATIVE (fresh cache)', diffCommitFastNativeFreshCache);

// Shared-cache variant: one cache reused across every commit in the batch
const sharedCache = {};
const sharedRun = await runBatch('NATIVE (shared cache)', (dir, oid, parentOid) =>
  diffCommitFastNativeWithCache(dir, oid, parentOid, sharedCache),
);

console.log(
  `\nFresh speedup:  ${(oldRun.ms / nativeRun.ms).toFixed(1)}× (native fresh vs old walk)`,
);
console.log(
  `Shared speedup: ${(oldRun.ms / sharedRun.ms).toFixed(1)}× (native shared vs old walk)`,
);
console.log(`Shared-vs-fresh: ${(nativeRun.ms / sharedRun.ms).toFixed(1)}× (cache reuse win)`);

const mismatches = nativeRun.counts.filter((n, i) => n !== oldRun.counts[i]);
if (mismatches.length > 0) {
  console.error(`\n⚠ MISMATCH: ${mismatches.length} commits have different counts`);
  process.exit(1);
}
console.log('Result counts match ✓');

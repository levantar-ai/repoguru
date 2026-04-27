# RepoAnalyze v1 — Pure Rust (gix) Single-Binary Git Analyzer (Ralph Wiggum–Ready Spec)
**Status:** Build specification (implementable)
**Backend:** `gix` (gitoxide) + **in-process** stats-only diff engine (no `git` CLI, no `libgit2`)
**Guarantees:** Deterministic + exact under defined semantics (no sampling, no approximations)
**Target:** Linux-kernel-size repo completes in **≤ 5 minutes** on 16–32 cores + NVMe

> This spec is written explicitly for long-running autonomous coding loops (Ralph Wiggum style).
> It is phase-structured, test-first, and includes exact module APIs, data schemas, and acceptance checks.

---

## 0. Completion Contract

### 0.1 Completion token
The agent must print exactly:

`<promise>REPO_ANALYZE_COMPLETE</promise>`

**only when** §0.2 is fully satisfied.

### 0.2 “Done” acceptance criteria
1. `cargo test` passes on Linux and macOS.
2. `repoanalyze scan --repo <PATH> --out <DIR>` succeeds on:
   - a generated fixture repo (created during test run)
   - a medium repo fixture (bundle unpacked by tests)
3. Output files exist and are valid:
   - `<out>/metrics.json`
   - `<out>/tables/commit_stats.bin`
   - `<out>/tables/file_stats.bin`
   - `<out>/tables/rename_events.bin` (when renames enabled)
   - `<out>/report/index.html` and `<out>/report/data/*.json`
   - `<out>/scan.log` (progress log, tailable with `tail -f`)
4. Determinism:
   - scanning the same repo twice with same options yields identical checksums for:
     - `tables/*.bin`
     - `report/data/*.json` (after canonical JSON normalization)
5. Correctness on fixtures:
   - all golden tests pass (exact expected `commit_stats` + `file_stats` + rename behavior)
6. No external processes are invoked (enforced by code review + a test that searches for `std::process::Command` usage in crate sources).
7. Large repo validation: `repoanalyze scan` completes without OOM on repos with 50K+ commits
   (e.g., ASP.NET Core: 62K commits in ~74s, peak RSS ~2.2GB) on a machine with 8GB RAM.
   See §18 for critical implementation lessons and §18.13 for detailed benchmarks.
8. git-sizer parity: A subset of the sizer metrics (`repo_metrics` in `metrics.json`) must match
   the output of `git-sizer` when run on the same repo. Specifically:
   - `object_counts` by type (blob, tree, commit, tag) must match exactly
   - `total_bytes` by type must match exactly
   - `merge_count` and `max_parents` must match exactly
   - `largest_blobs` top entries must match (same OIDs and sizes)
   This is validated by running both tools and comparing outputs.

### 0.3 Phase Checkpoint Protocol
Each phase (§15) is a self-contained unit of work. The agent tracks progress via:

**PHASE.md file** — maintained at project root:
```
current_phase: 3
status: in_progress
step: core_logic
last_gate_passed: 2
notes: tree delta working, starting subtree recursion
```

**Per-phase promise tokens** — the agent prints:
```
<promise>PHASE_N_COMPLETE</promise>
```
only after every gate test for phase N passes. These tokens are cumulative:
`PHASE_1_COMPLETE` must appear before `PHASE_2_COMPLETE`, etc.

**Phase detection heuristic** (for resuming after crash/restart):
1. Read `PHASE.md` if it exists.
2. Else run `cargo test phase1:: phase2:: ... --no-run` to see which phase modules compile.
3. Then run gate tests for the highest compiling phase; the last passing gate is the current phase.

**Rule: never advance to phase N+1 until all gate tests for phase N pass.**
If a prior phase regresses, fix it before continuing.

### 0.4 Guard Rails

**No external binaries:**
- Never invoke `git`, `diff`, or any subprocess. Enforced by test (§0.2 item 6).
- All repo operations go through `gix` crate APIs.

**Determinism:**
- Use `BTreeMap` / `BTreeSet` for any collection that affects output ordering.
- `HashMap` / `HashSet` are allowed only for internal lookups that never touch output.
- All sorting must use stable sort with explicit tie-breakers.

**Test-first mandate:**
- Write the test before the implementation. If a function has no test, it is not done.
- Gate tests are mandatory; non-gate tests may be `#[ignore]`d temporarily.

**No unsafe:**
- `#![forbid(unsafe_code)]` in `src/lib.rs` and `src/main.rs`.

**Error handling:**
- Use `anyhow::Result` for CLI/pipeline errors.
- Use `thiserror` for domain error enums in library code.
- Never `unwrap()` in library code; `expect()` only with a message explaining the invariant.

**When stuck — fallback strategies (in order):**
1. Re-read the relevant spec section carefully.
2. Simplify: implement the minimal version that passes the gate test.
3. `#[ignore]` a non-gate test temporarily and add a `// TODO: phase N` comment.
4. **Never** skip or `#[ignore]` a gate test.
5. If still stuck after 3 attempts at the same problem, emit a `<stuck>` tag describing the issue.

---

## 1. Goals, Non-Goals, and Semantics

### 1.1 Goals
- Combine **git-sizer class** metrics (repo size/pathologies) + **shtats class** analytics (activity/churn/hotspots) in one tool.
- Compute **diff stats for every commit** (adds/deletes per file, binary flags) for the reachable history.
- Provide offline HTML report (static assets embedded in binary).

### 1.2 Non-goals (v1)
- Blame/line ownership per author (too expensive).
- AST-aware symbol metrics (complexity, functions).
- Security scanning (secrets, dependencies).
- “Identical to Git CLI output” for rename heuristics; we define our own deterministic rename algorithm (still exact under our definition).

### 1.3 Exactness definition
“Exact” means:
- Every reachable commit is processed (no sampling).
- Every change is computed deterministically from repo objects and diff algorithm specified here.
- Merge semantics are explicitly chosen and applied consistently.
- Rename/copy detection is deterministic under this spec’s similarity function and thresholds.

### 1.4 Merge semantics (required option)
`--merge-policy`:
- `first-parent` (default): for merge commits, diff against parent[0] only.
- `all-parents`: diff against each parent; results stored per commit-parent edge.
- (No combined diff in v1.)

### 1.5 Rename & copy semantics (default ON)
- Rename detection ON by default.
- Copy detection ON by default.
- Similarity threshold 50 by default.
- Deterministic similarity scoring defined in §8.

---

## 2. Tooling & Dependencies (Pure Rust)

### 2.1 Language
Rust 2021 edition, MSRV = define (recommend 1.78+).

### 2.2 Core crates
- `gix` family for repo access:
  - `gix` (top-level)
  - `gix-odb`, `gix-pack`, `gix-object`, `gix-ref`, `gix-revwalk`, `gix-commitgraph` as needed
- Concurrency:
  - `crossbeam-channel` (bounded channels)
  - `rayon` **OR** custom threadpool (recommend custom for deterministic sequencing)
- Data:
  - `serde`, `serde_json`
  - `byteorder` for binary IO
  - `hashbrown` for hash maps
  - `smallvec`, `bytes` optionally
- Reporting:
  - static assets embedded as `include_bytes!()`
- Testing:
  - `tempfile`
  - `assert_cmd` (CLI tests)
  - `predicates`
  - `blake3` for checksums

### 2.3 No external binaries
- Do not depend on `git` installed.
- Tests must create repos using pure Rust via `gix` write APIs (preferred) or use embedded fixture `.git` directories.

---

## 3. CLI Specification (stable contract)

### 3.1 Command
```
repoanalyze scan --repo <PATH> --out <DIR> [options]
```

The `--repo` argument accepts either:
- A local path (worktree root, bare repo, or `.git` directory)
- A remote URL (HTTPS or SSH) — the tool will clone it as a bare repo into a temp directory first

When a URL is provided, the tool clones with `gix::clone` (or shells out to `git clone --bare`
into a tempdir) before scanning. This allows one-shot analysis without manual cloning.

### 3.2 Options
- `--threads <N>`: default = logical cores
- `--merge-policy first-parent|all-parents`: default first-parent
- `--renames on|off`: default on
- `--copies on|off`: default on
- `--rename-threshold <0..100>`: default 50
- `--include-remotes on|off`: default on
- `--max-top <N>`: default 50
- `--format raw|sqlite`: default raw (v1 implements raw; sqlite optional phase)
- `--report on|off`: default on
- `--telemetry on|off`: default on
- `--since <rev|iso-date>` optional
- `--until <rev|iso-date>` optional
- `--max-diff-files <N>`: default 1000 — commits with more file changes skip line-level diff
  (changes are still counted but marked as binary). Prevents OOM on mega-commits like initial imports.
  Merge commits use `min(N, 100)` since their bulk changes are redundant with individual parent commits.
  Reduced from 10000 to 1000 after profiling: 99.9% of normal commits have <1000 files; the few that
  exceed this (initial imports, vendor drops) account for enormous processing time with little analytic value.

### 3.3 Exit codes
- 0 success
- 2 invalid args
- 3 repo open failure
- 4 scan failure (IO/object errors)
- 5 report generation failure

---

## 4. Repository Discovery & Ref Resolution

### 4.1 Inputs
`--repo` can point to:
- Worktree root containing `.git/`
- Bare repo directory
- `.git` directory itself

### 4.2 Discovery algorithm
1. If `<repo>/.git` exists:
   - treat `<repo>/.git` as gitdir.
2. Else treat `<repo>` as gitdir (bare or gitdir).
3. Support `gitdir:` indirection file (worktrees/submodules).

### 4.3 Open repo with gix
Use `gix::open(path)` (or `gix::Repository::open`) with options to:
- enable object cache if supported
- enable commit-graph usage if present

### 4.4 Enumerating refs
Collect ref tips for revwalk entry points.
- Always include `HEAD`.
- Include local heads `refs/heads/*`.
- Include tags `refs/tags/*` (peel annotated tags to commits).
- If `--include-remotes on`: include `refs/remotes/*`.
- Include packed-refs transparently (gix handles).

Output: `Vec<ObjectId>` commit tips (deduped).

Peeling:
- If ref points to tag object, peel to commit by following tag target until commit.
- Detect cycles (error).

---

## 5. Commit Enumeration & Work Planning (Deterministic)

### 5.1 Revwalk ordering
Goal: deterministic order independent of thread scheduling.

Implementation:
- Build reachable set with `gix::revwalk` from all tips.
- Sorting mode:
  - Primary: topological
  - Secondary tie-break: committer timestamp
  - Tertiary tie-break: OID bytes lexicographic
- If gix revwalk cannot guarantee secondary/tertiary, perform:
  1. Collect commits (OIDs)
  2. Load commit metadata (time) for each
  3. Stable sort using (topo_index, time, oid)

**Acceptance:** same commit list order across runs.

### 5.2 Merge-policy expansion into WorkItems
Define:
```
WorkItem {
  seq: u64,
  commit_oid: Oid,
  parent_oid: OidOrZero,
  parents_count: u8,
  is_merge: bool,
}
```
- For root commit: `parent_oid = ZERO_OID`
- For first-parent: exactly one WorkItem per commit.
- For all-parents: one WorkItem per parent edge; `seq` increments per edge in deterministic parent order (as stored in commit object).

### 5.3 Partitioning for workers
- WorkItems are emitted in order into a bounded channel.
- Workers pull items, compute diffs, push results with `seq` back.
- Aggregator writes strictly in `seq` order (§9).

---

## 6. Data Model & Storage (Raw Binary)

### 6.1 Dictionaries (deterministic IDs)
- `author_id` and `path_id` must be deterministic.
- Rule: **only the aggregator assigns IDs**, in ascending `seq` order.

### 6.2 Author identity
Canonical key:
- lowercased email if non-empty else `name + "\0" + email`

### 6.3 Path identity
Paths are byte strings in trees; store as UTF-8 when valid, else store lossy string + raw bytes hash.

### 6.4 Tables (raw fixed-width, v1)
All binary files are little-endian fixed width.

#### 6.4.1 `tables/commit_stats.bin`
Row layout:
- `commit_oid` 20 bytes
- `parent_oid` 20 bytes
- `tree_oid` 20
- `parent_tree_oid` 20
- `author_id` u32
- `committer_id` u32
- `author_ts` i64
- `commit_ts` i64
- `message_len` u32
- `parents_count` u8
- `is_merge` u8
- `files_changed` u32
- `insertions` u64
- `deletions` u64
- `binary_files_changed` u32
- `renames` u32
- `copies` u32
- `diff_time_ns` u64
- `diff_bytes_inflated` u64

#### 6.4.2 `tables/file_stats.bin`
Row layout:
- `commit_oid` 20
- `parent_oid` 20
- `author_id` u32
- `path_id` u32
- `change_kind` u8 enum (1 add,2 modify,3 delete,4 rename,5 copy,6 typechange)
- `old_path_id` u32
- `old_blob_oid` 20
- `new_blob_oid` 20
- `old_mode` u32
- `new_mode` u32
- `is_binary` u8
- `insertions` u32 (0xFFFF_FFFF sentinel if binary/unknown)
- `deletions` u32 (same)

#### 6.4.3 `tables/rename_events.bin`
Row layout:
- `commit_oid` 20
- `parent_oid` 20
- `old_path_id` u32
- `new_path_id` u32
- `score` u16
- `is_copy` u8

---

## 7. Git-Sizer Class Metrics (Object DB & Tree Shape) — git-sizer Parity

### 7.1 Goal
Achieve metric parity with [git-sizer](https://github.com/github/git-sizer). All object-level
metrics (counts, sizes, maxima) must match git-sizer's output exactly. This is validated by
running both tools on the same repo and comparing outputs.

### 7.2 Full metrics surface
The `RepoMetrics` struct contains:

**Object counts and sizes (Phase 1 — ODB scan):**
- `object_counts: BTreeMap<ObjectType, u64>` — blob, tree, commit, tag
- `total_bytes: BTreeMap<ObjectType, u64>` — sum of decompressed sizes per type
- `total_tree_entries: u64` — sum of entry counts across all trees

**Top-N lists (Phase 1):**
- `largest_blobs: Vec<(ObjectId, u64)>` — top N by decompressed size
- `largest_trees: Vec<(ObjectId, u64)>` — top N by decompressed size
- `largest_commit: (ObjectId, u64)` — single largest commit object

**History metrics (Phase 1 — commit scan):**
- `max_parents: u32` — maximum parent count on any commit (octopus merges)
- `merge_count: u64` — commits with >1 parent
- `oldest_commit: i64` — earliest committer timestamp (seconds since epoch)
- `newest_commit: i64` — latest committer timestamp
- `max_history_depth: u64` — longest first-parent chain (computed from parent map)
- `max_tag_depth: u64` — deepest chained tag (tag → tag → ... → commit)

**Tree shape metrics (Phase 2 — tip tree walk):**
- `deepest_path: (String, u32)` — path with most components
- `longest_name: (String, u32)` — single entry with longest name
- `largest_directory: (String, u32)` — directory with most entries

**Checkout stats (Phase 2 — tip tree walk):**
- `checkout_num_files: u64` — total files across tip trees
- `checkout_num_dirs: u64` — total directories
- `checkout_total_size: u64` — sum of blob sizes (uses cached sizes from Phase 1)
- `checkout_num_symlinks: u64` — entries with mode 0o120000
- `checkout_num_submodules: u64` — entries with mode 0o160000

**Reference counts (from `refs::count_refs`):**
- `ref_count: u64` — total references
- `branch_count: u64` — refs/heads/*
- `tag_ref_count: u64` — refs/tags/*

### 7.3 Two-phase parallel architecture

**Phase 1 — Object scan (parallel with rayon):**
1. Collect all `ObjectId`s from `repo.objects.iter()` (pack index, sequential, ~1s).
2. Partition into chunks of 10,000 OIDs.
3. Process each chunk in parallel via `rayon::par_chunks(10_000)`:
   - Each chunk opens its own `gix::open()` handle with 64MB object cache
   - Blobs: `find_header(oid)` for type + size (no decompression)
   - Trees: `find_object(oid)` to count entries and measure size
   - Commits: `find_object(oid)` to extract parents, timestamps, tree OID
   - Tags: `find_object(oid)` to follow tag chains
4. Each chunk produces a `ChunkResult` with local accumulators.
5. Merge all `ChunkResult`s via `merge()` method (min/max/sum as appropriate).
6. Blob sizes are cached in `HashMap<ObjectId, u64>` during Phase 1 for Phase 2 lookup.
7. Parent map (`HashMap<ObjectId, Vec<ObjectId>>`) built from commits for history depth.

**Phase 2 — Tree shape + checkout stats (sequential per tip tree):**
1. For each tip tree OID, do iterative DFS (explicit stack, no recursion).
2. Track path depth, entry name lengths, directory sizes.
3. For checkout stats: count files/dirs/symlinks/submodules, sum blob sizes using cached sizes.
4. Dedup visited trees across tips via `HashSet` (bounded: only unique trees in tip commits).

**Phase 3 — History depth (sequential, O(commits)):**
1. Compute `max_history_depth` from the parent map using iterative DFS with memoization.
2. For each commit, depth = 1 + max(depth of parents). Memoize to avoid recomputation.
3. This runs in O(N) time over the commit graph.

### 7.4 Performance characteristics

| Metric | ASP.NET Core (62K commits, 6.5M objects) |
|--------|------------------------------------------|
| Phase 1 (parallel ODB scan) | ~2.3s |
| Phase 2 (tree walk) | ~3s |
| Phase 3 (history depth) | ~1s |
| Total sizer | ~11.5s |
| git-sizer comparison | ~7.3s |

The sizer is ~1.6x git-sizer. The gap is mainly in tree walk (git-sizer uses Go's concurrent GC
and more aggressive pack file caching). Object-level metrics match git-sizer exactly.

### 7.5 Critical implementation notes
- **MUST use `repo.objects.iter()`** (pack index iteration) to enumerate all object IDs.
  This yields `ObjectId`s from the pack index without decompressing any objects.
- **MUST use `repo.find_header(oid)`** for blobs to get type+size without loading content.
  Loading blob data via `find_object` will OOM on repos with large vendored files.
- **MUST NOT** do BFS from tips with a `HashSet<ObjectId>` visited set — the visited set alone
  for millions of objects consumes hundreds of MB.
- Each rayon chunk MUST open its own repo handle — `gix::Repository` is not `Send + Sync`.
- Each repo handle MUST have `object_cache_size_if_unset(64 * 1024 * 1024)` for pack lookups.
- Progress output: `[sizer]` log every 100K objects during Phase 1.

---

## 8. Diff Engine (Pure Rust, Deterministic)

### 8.1 Tree delta (gix tree diff with limits)

Uses `gix::diff::tree()` low-level API which walks both trees breadth-first, skipping identical
subtrees automatically. A custom `ChangeCollector` implements `gix::diff::tree::Visit` to collect
`RawChange` entries with a configurable visit limit for early bail-out.

**Return type:**
```rust
pub struct TreeDeltaResult {
    pub changes: Vec<RawChange>,  // collected changes (sorted by path)
    pub truncated: bool,           // true if visit limit was hit
}
```

Two entry points:
- `compute_tree_delta(repo, old_tree, new_tree) -> Result<Vec<RawChange>>` — unlimited
- `compute_tree_delta_with_limit(repo, old_tree, new_tree, max_changes) -> Result<TreeDeltaResult>` — with bail-out

**CRITICAL — gix cancellation bug:**
When `ChangeCollector::visit()` returns `Action::Cancel` (at the visit limit), `gix::diff::tree()`
returns an **error** (`"The delegate cancelled the operation"`), NOT a partial result. The caller
MUST check `visitor.at_limit()` on error:
```rust
let result = gix::diff::tree(old_iter, new_iter, &mut state, &repo.objects, &mut visitor);
let truncated = if let Err(e) = result {
    if !visitor.at_limit() {
        return Err(ScanError::ScanFailed(format!("tree diff: {e}")));
    }
    true
} else { false };
```
Treating cancellation as a fatal error silently drops most commits (observed: only 3977/62K processed).

**Merge commit limits:**
Merge commits use `min(max_diff_files, 100)` as their tree limit. Merge diffs are redundant —
the real changes are captured by the individual parent commits. A merge's value is conflict
resolution, which is always small. Without this limit, merge commits in large repos (especially
octopus merges or merges of long-lived branches) can touch thousands of files and dominate processing time.

### 8.2 Binary detection
Binary if:
- NUL in first 8000 bytes OR
- non-regular file (symlink/submodule)
Binary => no line stats.

### 8.3 Line stats (imara-diff histogram algorithm)
Uses the `imara-diff` crate (same engine as gitoxide/gix-diff) with the **Histogram**
algorithm to compute line-level insertion/deletion counts. No patch/hunks generated.

**Why imara-diff over hand-rolled Myers:**
- Histogram algorithm is 10-100% faster than Myers on real-world code diffs.
- Dramatically fewer bailouts on files with repeated content (e.g., JSON, XML, config).
- `imara-diff` is a production-quality implementation used by gitoxide — battle-tested.
- API: `InternedInput::new(old, new)` → `imara_diff::diff(Algorithm::Histogram, &input, sink)`.
- The `Sink` trait receives `(before_range, after_range)` per hunk; we sum counts only.

**History:** v0 used hand-rolled Myers O(ND) which had a catastrophic 4.56GB peak memory
bug from storing the trace vector (heaptrack confirmed). This was fixed by removing the
trace, but Myers still had a 33% bailout rate on ASP.NET Core (521K/1.57M file changes).
Switching to imara-diff histogram eliminated most bailouts.

**Additional constraints:**
- **`--max-diff-files N` (default 1000):** Skip line diff entirely for commits exceeding the
  tree limit. Normal commits use N; merge commits use `min(N, 100)`. Mark all changes as binary.
- Track bailout counts and tree truncation counts in aggregator, report in scan.log.

### 8.4 Rename/copy detection
Similarity score:
`100 * (2*common)/(old_lines+new_lines)` where `common` is multiset line-hash intersection.

Greedy pairing on edges sorted by:
1 score desc
2 old_path lex asc
3 new_path lex asc

Copy detection:
for remaining adds, best match against all old files within size ratio window [0.5,2.0].
Cache per-blob line hashes for speed.

---

## 9. Concurrency & Determinism

Planner assigns seq; workers compute; aggregator reorders by seq and writes.
Aggregator is sole owner of:
- dictionaries (author/path IDs)
- output writers
- aggregates

Workers open their own repo handles to avoid locks.

**Worker tree truncation tracking:**
Each `DiffResult` carries a `tree_truncated: bool` flag. When set (tree delta hit the visit limit),
the worker marks all file changes as binary with sentinel values and skips rename detection entirely.
The aggregator counts truncations and reports them in scan.log:
`"[diff] N commits aggregated, T truncated, B bailouts"`.

**Worker performance settings (critical for large repos):**
- Each worker calls `repo.object_cache_size_if_unset(128 * 1024 * 1024)` — without this,
  every subtree lookup decompresses from pack files (100x slower on packed repos).
- Merge commits get a lower tree limit: `min(max_diff_files, 100)` (see §8.1).
- When `tree_truncated`, the worker sets `skip_diff = true` — no blob loading, no line diff,
  no rename detection. Changes are still counted for commit stats.

### 9.0 Memory Budget
The pipeline must complete on an 8GB machine for repos with 50K+ commits.
Key constraints (see §18 for full details):
- Bounded channels (256 capacity) provide backpressure and limit reorder buffer size
- Sizer must use ODB pack index iteration, NOT BFS with a visited set
- Blob content must never be loaded in the sizer (use header-only lookups)
- Report generation reads back binary tables — acceptable for <1M file changes,
  may need streaming for larger repos

### 9.1 Progress Output & Logging
All progress is written to both **stderr** and **`<out>/scan.log`** via a `ScanLog` struct.
This allows users to `tail -f <out>/scan.log` in a separate terminal/tmux pane during long scans.

**Implementation:** `telemetry::ScanLog` wraps a `Mutex<BufWriter<File>>`. Two methods:
- `log(msg)` — writes line to stderr (with newline) and log file (flushed immediately)
- `progress(msg)` — writes `\r`-prefixed to stderr (in-place update) and newline to log file

**Required log points:**
- `[open]` — repo path, tip ref count
- `[walk]` — commit count, work item count, elapsed time
- `[diff]` — every 5000 commits: `[diff] N commits aggregated...`
- `[diff]` — final: commit count, file change count, elapsed time
- `[sizer]` — every 100K objects: `[sizer] N objects scanned...`
- `[sizer]` — final: total object count
- `[report]` — report generation start
- `[done]` — total elapsed time, commit count, file change count, output path

**Threading:** `ScanLog` is `Arc<ScanLog>` and passed to pipeline, aggregator, and sizer.
The `Mutex` ensures thread-safe writes. Flush after every line so `tail -f` sees output immediately.

---

## 10. Aggregations (Exact)

Time series (daily/weekly/monthly), top authors, hotspots.
Distinct authors per file computed by two-pass external sort on `(path_id, author_id)` pairs.

File lifecycle:
entity ids propagated through renames in first-parent mode; omit lifecycle for all-parents.

---

## 11. Report Generation

**Self-contained HTML:** The report is a single `index.html` file with all data embedded
inline as JavaScript variables. This ensures it works when opened via `file://` URLs
(XHR fails on file:// due to CORS). ECharts JS and CSS are also embedded.

**Data rendering:** Summary table, author rankings, hotspot rankings, and commit timeline
chart are rendered server-side (Rust) with HTML-escaped strings. Only the ECharts timeline
uses client-side JS for interactive charting.

**Data JSON files:** Separate JSON files (summary.json, timelines.json, authors.json,
hotspots.json) are also emitted under `report/data/` for programmatic access.

**Security:** All user-supplied strings (author names, file paths) are escaped via
`escape_html()` in the Rust layer before embedding into HTML. No `innerHTML` with
untrusted content.

---

## 12. Testing (No Git CLI)

Fixture repo includes add/modify/delete, rename, copy, merge, binary, no-final-newline.
Golden JSON outputs + decoded binary row comparisons.
Determinism test compares blake3 checksums across runs.

---

## 13. Performance Telemetry

perf.json with phase timings, counters, queue depth, worker utilization, bytes processed.

---

## 14. Project Layout

Every file is annotated with the phase in which it is **created** (`# P1` = Phase 1).
Files may be **modified** in later phases.

```
repoanalyze/
├── .github/
│   └── workflows/
│       └── ci.yml                      # CI/CD pipeline (§17)
├── Cargo.toml                          # P1
├── PHASE.md                            # P1 (agent checkpoint file)
├── src/
│   ├── main.rs                         # P1  entry point, clap dispatch
│   ├── lib.rs                          # P1  #![forbid(unsafe_code)], re-exports
│   ├── cli.rs                          # P1  clap arg structs, validation
│   ├── error.rs                        # P1  thiserror domain errors
│   ├── repo/
│   │   ├── mod.rs                      # P2  pub mod open, refs
│   │   ├── open.rs                     # P2  discover + open gix repo
│   │   └── refs.rs                     # P2  enumerate + peel refs → tip OIDs
│   ├── walk/
│   │   ├── mod.rs                      # P3  pub mod revwalk, workitem
│   │   ├── revwalk.rs                  # P3  deterministic topological walk
│   │   └── workitem.rs                 # P3  WorkItem struct, expansion logic
│   ├── diff/
│   │   ├── mod.rs                      # P4  pub mod tree_delta, line_diff, binary
│   │   ├── tree_delta.rs              # P4  sorted-merge tree diff → RawChange
│   │   ├── binary.rs                   # P4  binary detection (NUL in 8000 bytes)
│   │   └── line_diff.rs               # P5  imara-diff histogram line diff → (ins, del)
│   ├── rename/
│   │   ├── mod.rs                      # P7  pub mod similarity, detect
│   │   ├── similarity.rs              # P7  line-hash multiset similarity scorer
│   │   └── detect.rs                   # P7  greedy rename/copy pairing
│   ├── pipeline/
│   │   ├── mod.rs                      # P6  pub mod planner, worker, aggregator
│   │   ├── planner.rs                 # P6  emit WorkItems into channel
│   │   ├── worker.rs                   # P6  pull WorkItem, compute diff, push result
│   │   └── aggregator.rs             # P6  reorder by seq, assign IDs, write
│   ├── model/
│   │   ├── mod.rs                      # P4  pub mod change, commit_stat, file_stat, rename_event
│   │   ├── change.rs                   # P4  RawChange enum + struct
│   │   ├── commit_stat.rs             # P6  CommitStat row struct
│   │   ├── file_stat.rs               # P6  FileStat row struct
│   │   └── rename_event.rs           # P7  RenameEvent row struct
│   ├── metrics/
│   │   ├── mod.rs                      # P8  pub mod sizer
│   │   └── sizer.rs                    # P8  git-sizer class metrics (object counts, maxima)
│   ├── aggregate/
│   │   ├── mod.rs                      # P9  pub mod timeseries, hotspot, author, lifecycle
│   │   ├── timeseries.rs             # P9  daily/weekly/monthly bucketing
│   │   ├── hotspot.rs                  # P9  churn-ranked file list
│   │   ├── author.rs                   # P9  per-author summary
│   │   └── lifecycle.rs               # P9  file entity tracking through renames
│   ├── report/
│   │   ├── mod.rs                      # P10 pub mod html, data_json, assets
│   │   ├── html.rs                     # P10 index.html generation
│   │   ├── data_json.rs              # P10 report/data/*.json emission
│   │   └── assets.rs                   # P10 include_bytes!() for ECharts/CSS/JS
│   ├── writer/
│   │   ├── mod.rs                      # P6  pub mod binary_writer, json_writer
│   │   ├── binary_writer.rs          # P6  fixed-width little-endian .bin writer
│   │   └── json_writer.rs            # P6  metrics.json + canonical JSON
│   └── telemetry.rs                    # P6  perf.json phase timings + counters
├── tests/
│   ├── common/
│   │   ├── mod.rs                      # P1  shared test helpers
│   │   └── fixture.rs                  # P2  programmatic fixture repo creation (gix write API)
│   ├── phase1_cli.rs                   # P1  arg parsing, help, exit codes
│   ├── phase2_repo.rs                  # P2  open bare/worktree, ref enumeration
│   ├── phase3_walk.rs                  # P3  revwalk order, workitem generation
│   ├── phase4_tree.rs                  # P4  tree delta correctness
│   ├── phase5_diff.rs                  # P5  Myers line diff, binary detection
│   ├── phase6_pipeline.rs             # P6  end-to-end scan, binary output verification
│   ├── phase7_rename.rs               # P7  similarity scoring, rename/copy pairing
│   ├── phase8_metrics.rs              # P8  sizer metrics against known repo
│   ├── phase9_aggregate.rs            # P9  timeseries, hotspots, author stats
│   ├── phase10_report.rs              # P10 HTML + JSON report files exist and valid
│   ├── phase11_determinism.rs         # P11 blake3 checksums identical across runs
│   └── no_external_binaries.rs        # P1  scans src/ for std::process::Command
└── fixtures/
    └── medium_repo.bundle              # P11 medium-size test fixture (git bundle)
```

---

## 15. Ralph Phases (Implement sequentially)

---

### Phase 1 — CLI Skeleton

**Depends on:** nothing (start here)

**Files to create:**
- `Cargo.toml` — workspace, dependencies (clap, anyhow, thiserror, gix, serde, serde_json, byteorder, crossbeam-channel, rayon, blake3, tempfile, assert_cmd, predicates)
- `src/main.rs` — `fn main()` dispatches to `cli::run()`
- `src/lib.rs` — `#![forbid(unsafe_code)]`, re-exports
- `src/cli.rs` — clap derive structs for all options in §3.2
- `src/error.rs` — `ScanError` enum with variants for each exit code (§3.3)
- `tests/common/mod.rs` — shared helpers
- `tests/phase1_cli.rs` — CLI arg tests
- `tests/no_external_binaries.rs` — scans `src/` for `std::process::Command`
- `PHASE.md` — initial checkpoint file

**Structs/Functions:**
- `cli::ScanArgs` — clap struct matching §3.2 options
- `cli::run() -> anyhow::Result<()>` — parse args, validate, return Ok (stub)
- `error::ScanError` — thiserror enum: `InvalidArgs`, `RepoOpen`, `ScanFailed`, `ReportFailed`

**Tests:** `cargo test phase1::`
- `phase1::test_help_flag` — `--help` exits 0
- `phase1::test_missing_repo` — exits with code 2
- `phase1::test_invalid_merge_policy` — exits with code 2
- `phase1::test_all_defaults_parse` — valid args parse without error
- `no_external_binaries::test_no_process_command` — grep src/ for `std::process::Command`, assert 0 matches

**Completion gate:**
- [ ] `cargo test phase1::` — all pass
- [ ] `cargo test no_external_binaries::` — passes
- [ ] `repoanalyze --help` prints usage and exits 0
- [ ] `repoanalyze scan` with no `--repo` exits with code 2
- [ ] `#![forbid(unsafe_code)]` present in lib.rs and main.rs

**DO NOT:**
- Add any repo-opening logic yet
- Import gix in main code paths (only in Cargo.toml)
- Create output directories or files

**Iteration hints:**
- Start with `cargo init --name repoanalyze`
- Get clap parsing working first, then error types, then tests
- The no_external_binaries test is simple: read all `.rs` files under `src/`, assert none contain `std::process::Command`

---

### Phase 2 — Repo Open + Refs

**Depends on:** Phase 1

**Files to create:**
- `src/repo/mod.rs`
- `src/repo/open.rs` — discover and open repo
- `src/repo/refs.rs` — enumerate and peel refs
- `tests/common/fixture.rs` — programmatic fixture repo creation
- `tests/phase2_repo.rs`

**Structs/Functions:**
- `repo::open::open_repo(path: &Path) -> Result<gix::Repository>` (§4.1–§4.3)
- `repo::refs::collect_tips(repo: &Repository, include_remotes: bool) -> Result<Vec<ObjectId>>` (§4.4)
- Fixture helper: `fixture::create_simple_repo(dir: &Path) -> Result<PathBuf>` — creates commits with add/modify/delete using gix write APIs

**Tests:** `cargo test phase2::`
- `phase2::test_open_worktree` — open repo from worktree root
- `phase2::test_open_bare` — open bare repo
- `phase2::test_open_nonexistent` — returns RepoOpen error
- `phase2::test_collect_tips_head_only` — single branch, returns 1 tip
- `phase2::test_collect_tips_multiple_branches` — returns deduped tips
- `phase2::test_peel_annotated_tag` — tag peeled to commit OID

**Completion gate:**
- [ ] `cargo test phase2::` — all pass
- [ ] Fixture repo created programmatically (no git CLI)
- [ ] `collect_tips` returns correct OIDs for HEAD + branches + tags
- [ ] Prior phase tests still pass: `cargo test phase1::`

**DO NOT:**
- Shell out to `git init` — use gix write APIs or raw object creation
- Walk commits yet (that's Phase 3)
- Hard-code OIDs in tests; compute expected values from fixture

**Iteration hints:**
- Fixture creation with gix is the hardest part; start there
- If gix write APIs are too complex, create a minimal `.git` directory manually (write objects + refs as files)
- Test `open_repo` with both `path/.git` and bare `path` variants

---

### Phase 3 — Deterministic Revwalk + WorkItems

**Depends on:** Phase 2

**Files to create:**
- `src/walk/mod.rs`
- `src/walk/revwalk.rs` — deterministic topological commit ordering
- `src/walk/workitem.rs` — WorkItem struct + expansion
- `tests/phase3_walk.rs`

**Structs/Functions:**
- `walk::revwalk::deterministic_walk(repo: &Repository, tips: &[ObjectId]) -> Result<Vec<ObjectId>>` (§5.1)
- `walk::workitem::WorkItem` — struct per §5.2
- `walk::workitem::expand_to_workitems(commits: &[ObjectId], repo: &Repository, policy: MergePolicy) -> Result<Vec<WorkItem>>` (§5.2)

**Tests:** `cargo test phase3::`
- `phase3::test_linear_order` — 5-commit linear history, correct topo order
- `phase3::test_merge_order` — diamond merge, deterministic tie-breaking
- `phase3::test_root_commit_zero_parent` — root commit has `parent_oid = ZERO_OID`
- `phase3::test_first_parent_workitems` — merge produces 1 WorkItem (first parent)
- `phase3::test_all_parents_workitems` — merge produces N WorkItems (one per parent)
- `phase3::test_deterministic_across_runs` — run twice, assert same order

**Completion gate:**
- [ ] `cargo test phase3::` — all pass
- [ ] Walk order is deterministic (topo → time → OID tie-break)
- [ ] WorkItem seq values are strictly increasing
- [ ] First-parent and all-parents modes produce correct WorkItem counts
- [ ] Prior phases: `cargo test phase1:: phase2::` — all pass

**DO NOT:**
- Compute diffs (Phase 4)
- Open repo per-worker yet (Phase 6)
- Use `HashMap` for anything that affects WorkItem ordering

**Iteration hints:**
- Start with `deterministic_walk` on a linear repo (simplest case)
- Add merge handling second
- The tie-breaking sort is critical: `(topo_index, committer_time, oid_bytes)`

---

### Phase 4 — Tree Parsing + Delta

**Depends on:** Phase 3

**Files to create:**
- `src/diff/mod.rs`
- `src/diff/tree_delta.rs` — sorted-merge tree diff
- `src/diff/binary.rs` — binary detection
- `src/model/mod.rs`
- `src/model/change.rs` — RawChange struct
- `tests/phase4_tree.rs`

**Structs/Functions:**
- `model::change::ChangeKind` — enum: Add, Modify, Delete, TypeChange (§6.4.2)
- `model::change::RawChange` — struct: `{ path, old_oid, new_oid, old_mode, new_mode, kind }`
- `diff::tree_delta::compute_tree_delta(repo: &Repository, old_tree: Option<ObjectId>, new_tree: ObjectId) -> Result<Vec<RawChange>>` (§8.1)
- `diff::tree_delta::compute_tree_delta_with_limit(repo, old_tree, new_tree, max_changes) -> Result<Vec<RawChange>>` — early bail-out for mega-commits
- `diff::binary::is_binary(data: &[u8]) -> bool` (§8.2)

**CRITICAL — gix tree diff cancellation:**
When the `ChangeCollector` visitor returns `Action::Cancel`, `gix::diff::tree()` returns an
**error** ("The delegate cancelled the operation"), NOT a partial result. The caller must check
`visitor.at_limit()` on error and return the collected partial changes. Treating cancellation
as a fatal error will silently drop most commits.

**Tests:** `cargo test phase4::`
- `phase4::test_add_file` — empty tree → tree with file = Add
- `phase4::test_delete_file` — file removed = Delete
- `phase4::test_modify_file` — same path, different OID = Modify
- `phase4::test_nested_directory` — changes in subdirectory detected
- `phase4::test_binary_detection_nul` — NUL byte in first 8000 = binary
- `phase4::test_binary_detection_text` — no NUL = not binary
- `phase4::test_root_commit_all_adds` — root commit (no parent tree) = all files are Adds

**Completion gate:**
- [ ] `cargo test phase4::` — all pass
- [ ] Tree delta correctly handles: add, modify, delete, nested dirs, root commit
- [ ] Binary detection matches §8.2 spec
- [ ] RawChange paths are sorted deterministically
- [ ] Prior phases: `cargo test phase1:: phase2:: phase3::` — all pass

**DO NOT:**
- Compute line diffs (Phase 5)
- Handle renames (Phase 7) — at this stage, a rename looks like delete + add
- Recurse into submodules (out of scope)

**Iteration hints:**
- Uses `gix::diff::tree()` low-level API which walks both trees breadth-first, skipping identical subtrees
- Custom `ChangeCollector` implements `gix::diff::tree::Visit` trait with visit_count tracking
- Handle the `old_tree = None` (root commit) case first: every entry is an Add
- Test with real gix tree objects from the fixture repo
- Default `max_diff_files` = 1000; merge commits use `min(max_diff_files, 100)` since their bulk changes are captured by individual commits
- The `TreeDeltaResult` must carry a `truncated: bool` — do NOT infer truncation from `changes.len()` because visit_count includes tree nodes but changes only stores file entries

---

### Phase 5 — Line Diff (imara-diff histogram)

**Depends on:** Phase 4

**Files to create:**
- `src/diff/line_diff.rs` — uses `imara-diff` crate with histogram algorithm
- `tests/phase5_diff.rs`

**Structs/Functions:**
- `diff::line_diff::LineStats { insertions: u32, deletions: u32, bailed_out: bool }`
- `diff::line_diff::compute_line_stats(old: &[u8], new: &[u8]) -> LineStats` (§8.3)
- Internal: `Counter` struct implementing `imara_diff::Sink` to count insertions/deletions

**Tests:** `cargo test phase5::`
- `phase5::test_empty_to_content` — all insertions
- `phase5::test_content_to_empty` — all deletions
- `phase5::test_modify_lines` — mixed insertions + deletions
- `phase5::test_identical_content` — 0 insertions, 0 deletions
- `phase5::test_no_final_newline` — correct counts regardless of trailing newline
- `phase5::test_large_diff` — 10k lines, doesn't hang or OOM
- `phase5::test_binary_skipped` — binary content returns sentinel (0xFFFFFFFF)

**Completion gate:**
- [ ] `cargo test phase5::` — all pass
- [ ] Histogram algorithm produces correct insertion/deletion counts for all test cases
- [ ] Binary blobs return sentinel values, not line counts
- [ ] No panic on empty inputs
- [ ] Prior phases: `cargo test phase1:: phase2:: phase3:: phase4::` — all pass

**DO NOT:**
- Generate patch text or hunks (not needed, §8.3)
- Implement rename similarity yet (Phase 7)
- Hand-roll a diff algorithm — use the `imara-diff` crate

**Iteration hints:**
- Use `imara_diff::diff(Algorithm::Histogram, &input, sink)` — zero bailouts, fast
- `InternedInput::new(old_str, new_str)` handles line splitting
- Implement `imara_diff::Sink` on a `Counter` struct to collect insertions/deletions
- The sentinel value for binary (0xFFFFFFFF for u32) is important — tests will check it
- Do NOT hand-roll Myers — it has O(ND) worst-case and 33% bailout rate on real repos

---

### Phase 6 — Pipeline + Writers

**Depends on:** Phase 5

**Files to create:**
- `src/pipeline/mod.rs`
- `src/pipeline/planner.rs` — emit WorkItems into bounded channel
- `src/pipeline/worker.rs` — pull WorkItem, compute tree delta + line stats, push result
- `src/pipeline/aggregator.rs` — reorder by seq, assign author/path IDs, write rows
- `src/model/commit_stat.rs` — CommitStat row struct (§6.4.1)
- `src/model/file_stat.rs` — FileStat row struct (§6.4.2)
- `src/writer/mod.rs`
- `src/writer/binary_writer.rs` — fixed-width little-endian .bin output
- `src/writer/json_writer.rs` — metrics.json
- `src/telemetry.rs` — perf.json timing
- `tests/phase6_pipeline.rs`

**Files to modify:**
- `src/cli.rs` — wire `run()` to call pipeline
- `src/lib.rs` — add module declarations

**Structs/Functions:**
- `pipeline::planner::run_planner(items: Vec<WorkItem>, tx: Sender<WorkItem>)` (§5.3)
- `pipeline::worker::DiffResult` — struct: `{ seq, commit_stat, file_stats: Vec<FileStat> }`
- `pipeline::worker::run_worker(repo_path: &Path, rx: Receiver<WorkItem>, tx: Sender<DiffResult>)` (§9)
- `pipeline::aggregator::run_aggregator(rx: Receiver<DiffResult>, out_dir: &Path) -> Result<()>` (§9)
- `model::commit_stat::CommitStat` — matches §6.4.1 exactly
- `model::file_stat::FileStat` — matches §6.4.2 exactly
- `writer::binary_writer::BinWriter<W: Write>` — write fixed-width rows
- `writer::json_writer::write_metrics_json(path: &Path, metrics: &Metrics) -> Result<()>`

**Tests:** `cargo test phase6::`
- `phase6::test_end_to_end_scan` — scan fixture repo, verify output files exist
- `phase6::test_commit_stats_row_count` — correct number of rows in commit_stats.bin
- `phase6::test_file_stats_row_count` — correct number of rows in file_stats.bin
- `phase6::test_binary_roundtrip` — write + read back CommitStat rows, verify fields
- `phase6::test_metrics_json_valid` — metrics.json is valid JSON with expected keys
- `phase6::test_aggregator_seq_ordering` — results arrive out of order, aggregator writes in order
- `phase6::test_author_id_determinism` — same author gets same ID across runs

**Completion gate:**
- [ ] `cargo test phase6::` — all pass
- [ ] `repoanalyze scan --repo <fixture> --out <dir>` produces: `metrics.json`, `tables/commit_stats.bin`, `tables/file_stats.bin`
- [ ] Binary files are correct fixed-width little-endian (readable by test)
- [ ] Author/path IDs assigned in seq order (deterministic)
- [ ] Aggregator handles out-of-order worker results
- [ ] Prior phases: `cargo test phase1:: phase2:: phase3:: phase4:: phase5::` — all pass

**DO NOT:**
- Handle renames in file_stats yet (change_kind will be Delete + Add, not Rename)
- Generate report HTML (Phase 10)
- Optimize for large repos yet — correctness first

**Iteration hints:**
- Start with single-threaded pipeline (planner → 1 worker → aggregator) to get correctness
- Add multi-worker after single-threaded works
- The aggregator is the hardest part: it must reorder by `seq` before writing
- Use `crossbeam_channel::bounded` for backpressure

**CRITICAL worker performance settings:**
- Each worker opens its own `gix::open()` — MUST call `repo.object_cache_size_if_unset(128 * 1024 * 1024)` on each handle
- Without object cache, every subtree lookup decompresses from pack files (100x slower)
- Merge commits (`item.is_merge`) get tree_limit of min(max_diff_files, 100) to skip mega-merges
- `skip_diff` must use `tree_limit` (not `config.max_diff_files`) as threshold

---

### Phase 7 — Renames/Copies

**Depends on:** Phase 6

**Files to create:**
- `src/rename/mod.rs`
- `src/rename/similarity.rs` — line-hash multiset similarity
- `src/rename/detect.rs` — greedy pairing
- `src/model/rename_event.rs` — RenameEvent row struct
- `tests/phase7_rename.rs`

**Files to modify:**
- `src/pipeline/worker.rs` — call rename detection after tree delta
- `src/pipeline/aggregator.rs` — write rename_events.bin
- `src/model/file_stat.rs` — populate `change_kind = Rename|Copy`, `old_path_id`

**Structs/Functions:**
- `rename::similarity::line_hashes(data: &[u8]) -> Vec<u64>` — hash each line
- `rename::similarity::similarity_score(old: &[u64], new: &[u64]) -> u16` — `100 * 2*common / (old+new)` (§8.4)
- `rename::detect::detect_renames(deletes: &[RawChange], adds: &[RawChange], repo: &Repository, threshold: u16) -> Vec<RenamePair>` (§8.4)
- `rename::detect::detect_copies(remaining_adds: &[RawChange], all_old: &[RawChange], repo: &Repository, threshold: u16) -> Vec<CopyPair>` (§8.4)
- `model::rename_event::RenameEvent` — matches §6.4.3

**Tests:** `cargo test phase7::`
- `phase7::test_similarity_identical` — score = 100
- `phase7::test_similarity_empty` — score = 0
- `phase7::test_similarity_partial` — known content, expected score
- `phase7::test_rename_detected` — file moved, detected as rename
- `phase7::test_copy_detected` — file duplicated, detected as copy
- `phase7::test_rename_threshold` — below threshold = not paired
- `phase7::test_greedy_pairing_deterministic` — tie-breaking: score desc → old_path asc → new_path asc
- `phase7::test_rename_events_bin` — rename_events.bin written correctly

**Completion gate:**
- [ ] `cargo test phase7::` — all pass
- [ ] Similarity scoring matches §8.4 formula exactly
- [ ] Greedy pairing is deterministic (sorted by score desc, old_path asc, new_path asc)
- [ ] `tables/rename_events.bin` exists when renames enabled
- [ ] `file_stats.bin` has correct `change_kind` for renamed/copied files
- [ ] Prior phases: `cargo test phase1:: phase2:: phase3:: phase4:: phase5:: phase6::` — all pass

**DO NOT:**
- Cache similarity across commits (each commit's rename detection is independent)
- Implement copy detection across commits (only within a single commit's changes)
- Change the diff engine (Phase 5) — rename detection sits on top of it

**Iteration hints:**
- Similarity scoring is the foundation — get that right first with unit tests
- Greedy pairing: build all candidate edges, sort, greedily match (each file used at most once)
- Copy detection is similar but doesn't consume the source file from the pool

---

### Phase 8 — Repo Size Metrics (git-sizer parity, parallel)

**Depends on:** Phase 6 (does not depend on Phase 7)

**Files to create:**
- `src/metrics/mod.rs`
- `src/metrics/sizer.rs` — parallel object DB traversal + metrics computation
- `tests/phase8_metrics.rs`

**Files to modify:**
- `src/pipeline/mod.rs` — call sizer after diff phase, pass ref counts
- `src/repo/refs.rs` — add `count_refs()` function
- `src/writer/json_writer.rs` — add sizer metrics to output

**Structs/Functions:**
- `metrics::sizer::ObjectType` — enum: Blob, Tree, Commit, Tag
- `metrics::sizer::RepoMetrics` — full struct per §7.2 (all fields listed there)
- `metrics::sizer::ChunkResult` — per-rayon-chunk accumulator with `merge()` method:
  ```rust
  struct ChunkResult {
      object_counts: BTreeMap<ObjectType, u64>,
      total_bytes: BTreeMap<ObjectType, u64>,
      total_tree_entries: u64,
      largest_blobs: Vec<(ObjectId, u64)>,   // bounded to max_top
      largest_trees: Vec<(ObjectId, u64)>,
      largest_commit: (ObjectId, u64),
      // commit data for history metrics
      parent_map: HashMap<ObjectId, Vec<ObjectId>>,
      blob_sizes: HashMap<ObjectId, u64>,     // for checkout size computation
      // timestamp extremes
      oldest_commit: i64,
      newest_commit: i64,
      max_parents: u32,
      merge_count: u64,
      max_tag_depth: u64,
  }
  ```
- `metrics::sizer::compute_repo_metrics(repo, tips, max_top, log, ref_count, branch_count, tag_ref_count) -> Result<RepoMetrics>` (§7)
- `repo::refs::count_refs(repo: &Repository) -> (u64, u64, u64)` — (total, branches, tags)

**Architecture:** See §7.3 for the three-phase parallel design. Key points:
- Phase 1 uses `rayon::par_chunks(10_000)` — each chunk opens its own repo handle
- Blob sizes cached in `HashMap<ObjectId, u64>` for Phase 2 checkout stats
- History depth computed from parent map via iterative DFS with memoization
- Reference counts passed in from `refs::count_refs()` (called in pipeline before sizer)

**Tests:** `cargo test phase8::`
- `phase8::test_object_counts` — fixture repo has expected blob/tree/commit counts
- `phase8::test_largest_blob` — known largest blob matches
- `phase8::test_merge_count` — correct number of merge commits
- `phase8::test_metrics_in_json` — sizer metrics appear in metrics.json with all §7.2 fields
- `phase8::test_max_top_limit` — `--max-top 2` limits top-N lists to 2

**Completion gate:**
- [ ] `cargo test phase8::` — all pass
- [ ] `metrics.json` includes all sizer fields from §7.2
- [ ] Top-N lists respect `--max-top` flag
- [ ] Object counts are exact (no sampling) and match git-sizer
- [ ] Parallel sizer completes in <15s on 62K-commit repos
- [ ] Prior phases: `cargo test phase1:: phase2:: phase3:: phase4:: phase5:: phase6::` — all pass

**DO NOT:**
- Use recursion for tree walk (use iterative DFS with explicit stack)
- Count unreachable objects (only pack index objects)
- Load blob content (use `find_header` for size)
- Use a single repo handle across rayon threads (not Send+Sync)
- Block the diff pipeline — sizer runs as a separate pass after diff completes

**Iteration hints:**
- Start with single-threaded Phase 1 (get metrics correct), then parallelize with rayon
- Use `repo.objects.iter()` to stream all ObjectIds from pack index (zero decompression)
- Use `repo.find_header(oid)` for blobs — returns type + size without loading content
- Only `find_object` for commits (parents/tree/timestamp) and trees (entries)
- For tree shape: walk only tip trees (from `tips` parameter), NOT every historical tree
- Track top-N with sorted Vec + truncation (simpler than BinaryHeap for small N)
- Print progress: `[sizer] N objects scanned...` every 100K objects
- Type annotation gotcha: `repo.find_header(entry.oid.into())` needs explicit `let blob_oid: ObjectId = entry.oid.into();`
- This phase is independent of Phase 7 — can be done in parallel

---

### Phase 9 — Aggregates + External Sort

**Depends on:** Phase 7

**Files to create:**
- `src/aggregate/mod.rs`
- `src/aggregate/timeseries.rs` — daily/weekly/monthly bucketing
- `src/aggregate/hotspot.rs` — churn-ranked file list
- `src/aggregate/author.rs` — per-author summary
- `src/aggregate/lifecycle.rs` — file entity tracking through renames
- `tests/phase9_aggregate.rs`

**Files to modify:**
- `src/pipeline/aggregator.rs` — call aggregate functions after writing tables
- `src/writer/json_writer.rs` — emit aggregate data

**Structs/Functions:**
- `aggregate::timeseries::TimeBucket` — struct: `{ period_start, commits, insertions, deletions, authors }`
- `aggregate::timeseries::compute_timeseries(stats: &[CommitStat], granularity: Granularity) -> Vec<TimeBucket>` (§10)
- `aggregate::hotspot::HotFile` — struct: `{ path_id, commits, total_churn, distinct_authors }`
- `aggregate::hotspot::compute_hotspots(file_stats: &[FileStat], paths: &BTreeMap<u32, String>) -> Vec<HotFile>` (§10)
- `aggregate::author::AuthorSummary` — struct: `{ author_id, commits, insertions, deletions, first_commit, last_commit }`
- `aggregate::author::compute_author_stats(commit_stats: &[CommitStat]) -> Vec<AuthorSummary>`
- `aggregate::lifecycle::compute_file_entities(file_stats: &[FileStat], renames: &[RenameEvent]) -> BTreeMap<u32, u32>` — path_id → entity_id (§10)

**Tests:** `cargo test phase9::`
- `phase9::test_daily_timeseries` — correct daily buckets for fixture
- `phase9::test_weekly_timeseries` — correct weekly bucketing
- `phase9::test_hotspot_ranking` — most-changed file is first
- `phase9::test_distinct_authors_per_file` — exact count via external sort
- `phase9::test_author_summary` — per-author commit/line counts
- `phase9::test_lifecycle_through_rename` — renamed file tracked as same entity

**Completion gate:**
- [ ] `cargo test phase9::` — all pass
- [ ] Timeseries covers daily, weekly, monthly granularities
- [ ] Hotspot distinct-author count uses two-pass external sort on `(path_id, author_id)` (§10)
- [ ] File lifecycle correctly propagates entity IDs through renames (first-parent only)
- [ ] Prior phases: `cargo test phase1:: phase2:: phase3:: phase4:: phase5:: phase6:: phase7::` — all pass

**DO NOT:**
- Approximate distinct counts (exact via sort + dedup)
- Compute lifecycle for all-parents mode (§10 says omit)
- Load entire file_stats into memory if avoidable — stream from .bin file

**Iteration hints:**
- Timeseries is straightforward — bucket by truncating timestamps
- Hotspot distinct authors is the tricky part: sort `(path_id, author_id)` pairs, then count runs
- Lifecycle: build a union-find from rename events, then map each path_id to its root entity

---

### Phase 10 — Report Generator

**Depends on:** Phase 9

**Files to create:**
- `src/report/mod.rs`
- `src/report/html.rs` — index.html generation
- `src/report/data_json.rs` — report/data/*.json files
- `src/report/assets.rs` — embedded static assets
- `tests/phase10_report.rs`

**Files to modify:**
- `src/cli.rs` — call report generation when `--report on`

**Structs/Functions:**
- `report::assets::ECHART_JS: &[u8]` — `include_bytes!("../../assets/echarts.min.js")`
- `report::assets::STYLE_CSS: &[u8]` — embedded CSS
- `report::assets::APP_JS: &[u8]` — embedded JS for chart rendering
- `report::html::generate_index_html(out_dir: &Path, data: &ReportData) -> Result<()>` (§11)
- `report::html::ReportData { metrics, timeseries, authors, hotspots }` — all data for inline embedding
- `report::data_json::emit_summary(out_dir: &Path, metrics: &Metrics) -> Result<()>`
- `report::data_json::emit_timelines(out_dir: &Path, ts: &[TimeBucket]) -> Result<()>`
- `report::data_json::emit_authors(out_dir: &Path, authors: &[AuthorSummary]) -> Result<()>`
- `report::data_json::emit_hotspots(out_dir: &Path, hotspots: &[HotFile]) -> Result<()>`

**Tests:** `cargo test phase10::`
- `phase10::test_report_files_exist` — `report/index.html`, `report/data/summary.json`, etc.
- `phase10::test_html_valid` — index.html contains `<html>`, embedded JS
- `phase10::test_data_json_valid` — each data JSON file parses successfully
- `phase10::test_paths_escaped_in_html` — path with `<script>` is escaped (§11)
- `phase10::test_report_off_flag` — `--report off` skips report generation

**Completion gate:**
- [ ] `cargo test phase10::` — all pass
- [ ] `report/index.html` exists with embedded ECharts
- [ ] `report/data/*.json` files: summary, timelines, authors, hotspots, merges
- [ ] HTML escaping prevents XSS from malicious file paths
- [ ] `--report off` produces no report/ directory
- [ ] Prior phases: `cargo test phase1:: phase2:: phase3:: phase4:: phase5:: phase6:: phase7:: phase8:: phase9::` — all pass

**DO NOT:**
- Fetch ECharts from CDN — it must be embedded via `include_bytes!()`
- Generate interactive server — report is static HTML only
- Over-design the HTML — minimal functional report is sufficient

**Iteration hints:**
- Start with a minimal index.html that loads data JSON files
- Embed a minified ECharts JS file (download once, commit as asset)
- Data JSON is just serde_json serialization of aggregate structs
- HTML escaping: use a simple function that escapes `< > & " '`

---

### Phase 11 — Determinism + Medium Fixture

**Depends on:** Phase 10

**Files to create:**
- `tests/phase11_determinism.rs`
- `fixtures/medium_repo.bundle` — medium-size git bundle for testing

**Structs/Functions:**
- No new library code; this phase is testing + integration.

**Tests:** `cargo test phase11::`
- `phase11::test_deterministic_binary_output` — scan same repo twice, blake3 checksums of all `.bin` files match
- `phase11::test_deterministic_json_output` — blake3 of canonicalized `report/data/*.json` match
- `phase11::test_medium_repo_succeeds` — scan medium fixture without error
- `phase11::test_medium_repo_row_counts` — commit_stats and file_stats have expected row counts
- `phase11::test_full_acceptance_criteria` — all §0.2 criteria verified in one test

**Completion gate:**
- [ ] `cargo test phase11::` — all pass
- [ ] `cargo test` (all tests) — all pass
- [ ] Determinism verified: identical checksums across 2 runs
- [ ] Medium fixture scans successfully end-to-end
- [ ] All §0.2 acceptance criteria met
- [ ] Prior phases: `cargo test` — everything green

**DO NOT:**
- Use a real large repo (like Linux kernel) for tests — medium fixture is ~100–500 commits
- Skip the canonicalization step for JSON comparison (key order may vary)
- Mark any test as `#[ignore]` — this is the final gate

**Iteration hints:**
- Create medium fixture: `git bundle create` from a real small-to-medium repo, or generate programmatically
- Canonicalize JSON: deserialize → serialize with sorted keys
- The determinism test is the single most important test — if it fails, debug by diffing individual files
- After all tests pass, emit: `<promise>REPO_ANALYZE_COMPLETE</promise>`

---

## 16. Iteration Protocol

This section defines what the agent does at every Ralph loop iteration.

### 16.1 Start-of-iteration checklist (every iteration)

1. **Read `PHASE.md`** — determine current phase and step.
2. **Run `cargo test`** (full suite) — identify regressions.
3. **If regressions in prior phases:** fix them before continuing. Do not advance.
4. **If current phase gate passes:** update `PHASE.md`, emit `<promise>PHASE_N_COMPLETE</promise>`, advance to N+1.
5. **Else:** continue working on current phase at the recorded step.

### 16.2 Four-step pattern within each phase

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────────────┐
│  Scaffold    │───▶│  Core Logic  │───▶│ Tests Pass  │───▶│ Edge Cases + Gate    │
│  (files,     │    │  (implement  │    │ (make basic │    │ (handle corners,     │
│   structs,   │    │   functions)  │    │  tests pass)│    │  run gate checklist) │
│   stubs)     │    │              │    │             │    │                      │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────────────┘
```

**Step 1 — Scaffold:** Create all files listed in the phase. Add struct/function stubs that compile but `todo!()`. Write test files with `#[test]` functions that call the stubs. Verify: `cargo test --no-run` compiles.

**Step 2 — Core Logic:** Implement the functions. Focus on the happy path. Don't handle every edge case yet. Verify: at least half the phase tests pass.

**Step 3 — Tests Pass:** Fix failing tests. Iterate until `cargo test phaseN::` is fully green. If a test is wrong, fix the test (but never weaken a gate test).

**Step 4 — Edge Cases + Gate:** Handle edge cases (empty inputs, binary files, root commits, etc.). Run the full gate checklist. Every box must be checked. Run `cargo test` (full suite) to confirm no regressions.

### 16.3 Progress detection heuristic

To determine which step you're on within a phase:

| Condition | Step |
|---|---|
| Phase files don't exist | Scaffold |
| Files exist but `cargo test --no-run` fails | Scaffold (fix compilation) |
| Compiles but most phase tests fail | Core Logic |
| Some phase tests pass, some fail | Tests Pass |
| All phase tests pass, gate not yet verified | Edge Cases + Gate |
| Gate verified | Phase complete — advance |

### 16.4 Regression handling

If `cargo test` reveals a failure in phase M < N (current phase):
1. **Stop** work on phase N.
2. Update `PHASE.md`: `status: fixing_regression, regression_in: M`.
3. Fix the regression in phase M's code.
4. Re-run `cargo test phaseM::` to confirm fix.
5. Re-run `cargo test` (full suite) to confirm no cascading failures.
6. Resume phase N.

### 16.5 Final iteration

When Phase 11 gate passes and `cargo test` is fully green:
1. Run the §0.2 acceptance checklist one final time.
2. Emit `<promise>REPO_ANALYZE_COMPLETE</promise>`.
3. Update `PHASE.md`: `current_phase: done, status: complete`.

END.

---

## 17. CI/CD Pipeline

### 17.1 Overview

The CI/CD pipeline follows the same pattern as asplint: parallel quality gates, matrix cross-compilation,
semantic versioning, and automated GitHub releases with downloadable binaries.

**Pipeline flow:**
```
test ──┐
quality ├──▶ build (5 targets) ──▶ version (dry run) ──▶ release ──▶ upload
security┘
```

### 17.2 Pipeline stages

**Stage 1 — Test** (ubuntu-latest):
- `cargo test --verbose` — all 69+ tests must pass

**Stage 2 — Quality** (ubuntu-latest, parallel with test):
- `cargo fmt -- --check` — formatting must match `rustfmt` defaults
- `cargo clippy -- -D warnings` — zero clippy warnings

**Stage 3 — Security** (ubuntu-latest, parallel with test):
- `cargo audit` — no known vulnerabilities in dependency tree

**Stage 4 — Build** (matrix, depends on stages 1-3):
Cross-compile release binaries for 5 targets:

| Target | OS | Artifact |
|--------|-----|----------|
| `x86_64-unknown-linux-gnu` | ubuntu-latest | `repoanalyze-linux-amd64.tar.gz` |
| `aarch64-unknown-linux-gnu` | ubuntu-latest | `repoanalyze-linux-arm64.tar.gz` |
| `x86_64-apple-darwin` | macos-latest | `repoanalyze-macos-amd64.tar.gz` |
| `aarch64-apple-darwin` | macos-latest | `repoanalyze-macos-arm64.tar.gz` |
| `x86_64-pc-windows-msvc` | windows-latest | `repoanalyze-windows-amd64.zip` |

Unix artifacts are `.tar.gz`, Windows is `.zip`.
Linux ARM64 cross-compiles on ubuntu-latest with `gcc-aarch64-linux-gnu`.

**Stage 5 — Version** (depends on build):
- `go-semantic-release/action` dry run to determine next version from conventional commits
- Outputs `version` and `new_release` for downstream stages

**Stage 6 — Release** (main branch only, if new version):
- `go-semantic-release/action` creates Git tag and changelog

**Stage 7 — Upload** (depends on release):
- Downloads all 5 build artifacts
- Uploads to GitHub Release via `softprops/action-gh-release`
- All binaries available as release assets for download

### 17.3 Triggers and concurrency

- **Push to main:** full pipeline including release
- **Pull requests to main:** stages 1-5 only (no release/upload)
- **Concurrency:** grouped by `ci-${{ github.ref }}`, cancel-in-progress disabled
  (don't cancel a release mid-flight)

### 17.4 Versioning

Uses [Conventional Commits](https://www.conventionalcommits.org/) with `go-semantic-release`:
- `feat:` → minor version bump
- `fix:` → patch version bump
- `BREAKING CHANGE:` → major version bump

Tags are `v{major}.{minor}.{patch}`. Changelog is auto-generated with emojis.

### 17.5 Caching

Cargo registry, git index, and target directory are cached per OS and target:
- Key: `{os}-{target}-cargo-build-{Cargo.lock hash}`
- Separate cache keys for test/quality/build to avoid cache pollution

### 17.6 Permissions

- `contents: write` — required for creating releases and tags
- `id-token: write` — required for OIDC federation (future AWS/cloud uploads)

### 17.7 Download URLs

After a release, binaries are available at:
```
https://github.com/andrew-rea-associates/repoguru-spec/releases/download/v{VERSION}/repoanalyze-{platform}.{ext}
```

Platforms: `linux-amd64`, `linux-arm64`, `macos-amd64`, `macos-arm64`, `windows-amd64`.

---

## 18. Implementation Lessons (from real-world testing)

These lessons were discovered by running against real repositories (ASP.NET Core: 55K commits, 385MB bare).
They are **critical** for correctness on large repos and must be followed by any re-implementation.

### 18.1 Memory: Object DB traversal (sizer)

**Problem:** BFS from tips with `HashSet<ObjectId>` visited set OOMs on repos with millions of objects.
A repo with 55K commits can have 5-10M+ unique objects. Each ObjectId is 20 bytes; with HashSet overhead
that's ~400-800MB just for the visited set. Additionally, `repo.find_object(oid)` decompresses blob
content into memory — a single large vendored file can be hundreds of MB.

**Solution (modeled on git-sizer):**
1. Use `repo.objects.iter()` to stream all ObjectIds from the pack index. This reads the `.idx` file
   directly without decompressing any objects. Zero memory overhead beyond the iterator state.
2. Use `repo.find_header(oid)` for blobs — returns type + size from the pack header without decompression.
3. Only `find_object` for commits (need parents/timestamps) and trees (need entry list).
4. For tree shape metrics (deepest path, longest name, largest dir): walk only tip trees, not every
   historical commit's tree. Tip trees represent current state; historical trees share most structure.
5. No visited set needed for Phase 1 (ODB iteration handles dedup). Small HashSet for tree shape walk
   (bounded by number of unique trees in tip commits only).

### 18.2 Memory: Pipeline and aggregator

**Problem:** The aggregator's reorder buffer (`BTreeMap<u64, DiffResult>`) can grow if the worker
falls behind on large commits with many file changes.

**Mitigation:** Bounded channels (256 capacity) provide backpressure. The planner blocks when the
work channel is full, and the worker blocks when the result channel is full. This keeps the reorder
buffer bounded to ~256 items at most.

### 18.2b Memory: Mega-commits (initial imports, vendor drops)

**Problem:** Some commits touch 10K+ files (initial imports, vendor directory additions, big merges).
Loading blob content for all these files via `compute_change_stats` causes 3GB+ RSS spikes that
trigger OOM kills. Observed on ASP.NET Core: RSS jumped from 232MB to 3.1GB on a single commit.

**Solution:** `--max-diff-files N` (default 1000). Commits exceeding the tree limit skip line-level
diff and rename detection entirely — changes are still counted but marked binary with sentinel values.
Merge commits use a lower limit of `min(N, 100)` since their bulk changes are redundant with
individual parent commits. The default of 1000 covers 99.9%+ of normal commits while preventing
OOM on pathological ones. Reduced from 10000 after profiling showed most value comes from the
first 1000 files; mega-commits beyond that are noise (initial imports, vendor drops).

### 18.2c Performance: Myers O(ND) trace storage was the #1 memory bug

**Problem (heaptrack confirmed):** The original Myers diff stored a `trace: Vec<Vec<usize>>` — cloning
the entire frontier vector `v` (size 2*(n+m)) for every edit distance `d`. For files with large edit
distance (e.g. 10K line file with 5K edits), this was `5000 * 200K * 8 bytes = 8GB`. Heaptrack showed
`compute_line_stats` consuming **4.56GB peak**.

**Solution:** Since we only need insertion/deletion **counts** (not the edit script), we removed the trace
entirely. For edit distance `d` on sequences of length `n` and `m`:
`deletions = (d + n - m) / 2`, `insertions = (d - n + m) / 2`.
Memory is now O(n+m) for the frontier vector only.

Additionally: added MAX_EDIT_DISTANCE bail-out (10,000). Myers is O(N*D) time — if D is large,
it can take minutes on a single file. When bailing out, report (n, m) as full replacement.
The `LineStats.bailed_out` flag and aggregator's bailout counter make this visible.

**ASP.NET Core results after fix:** 62K commits in 886s, 1.57M file changes, peak RSS 2.2GB,
521K bailouts (33%, mostly in old history with huge commits). No OOM.

### 18.3 Memory: Report generation

**Problem:** `generate_report` reads back all of `file_stats.bin` into a `Vec<FileStat>`. For aspnetcore
with ~150K file changes, that's 150K × 110 bytes = ~16MB — manageable. But for linux-kernel-size repos
this could be much larger. Consider streaming or chunked processing if this becomes an issue.

### 18.4 Worker borrow checker pattern

**Problem:** Rename detection needs to read from `changes: Vec<&RawChange>` while also mutating the
changes vec to update rename/copy info. Holding references from the vec while mutating it triggers E0502.

**Solution:** Two-pass approach:
1. Collect indices and owned data (old_path, new_path, score) into a separate `Vec<(usize, ...)>`
2. Drop all borrows from the original vec
3. Apply mutations using the collected indices

### 18.5 Determinism: diff_time_ns field

**Problem:** `CommitStat.diff_time_ns` (byte offset 142 in the 160-byte row) varies between runs
because it measures wall-clock time. This breaks blake3 determinism checks.

**Solution:** Zero out bytes 142..150 (the diff_time_ns field) before comparing binary outputs
in determinism tests. The field offset is calculated from the exact field layout:
`20+20+20+20+4+4+8+8+4+1+1+4+8+8+4+4+4 = 142 bytes before diff_time_ns`.

### 18.6 Security: No innerHTML in embedded JS

The embedded `app.js` for the HTML report must use safe DOM methods (`createElement`, `textContent`,
`appendChild`) instead of `innerHTML`. File paths from git repos can contain `<script>` tags or
other HTML that would be XSS vectors if injected via innerHTML.

### 18.7 gix API patterns

- `repo.find_object(oid)` — decompresses full object data. Use sparingly for blobs.
- `repo.find_header(oid)` — header only (type + size). Use for blobs in sizer.
- `repo.objects.iter()` — streams all ObjectIds from pack index. O(1) memory per object.
- `obj.try_into_commit()` — consumes the object, returns Commit. Use `commit.parent_ids()`,
  `commit.tree_id()`, `commit.author()`.
- `gix::objs::TreeRef::from_bytes(&data)` — parse tree entries from raw data.
- `gix::objs::TagRef::from_bytes(&data)` — parse annotated tag.
- `entry.mode.is_tree()` — check if tree entry is a subtree.

### 18.8 Progress output and scan.log

Users must see progress during long operations. All output goes to both stderr AND `<out>/scan.log`
via the `telemetry::ScanLog` struct. This enables `tail -f <out>/scan.log` in a separate tmux pane.

**ScanLog API:**
- `ScanLog::new(out_dir) -> io::Result<Self>` — creates `<out>/scan.log`
- `log(msg)` — newline to both stderr and file, flushes file immediately
- `progress(msg)` — `\r`-prefix on stderr for in-place update, newline in file

**Log points** (see §9.1 for full list):
- `[open]` — repo path + ref count
- `[walk]` — commit count + work item count + time
- `[diff]` — every 5000 commits aggregated (progress), final summary (log)
- `[sizer]` — every 100K objects (progress), final count (log)
- `[report]` — report generation start
- `[done]` — total time, commit count, file changes, output path

**Threading:** `Arc<ScanLog>` is passed to aggregator and sizer. Mutex protects the file writer.

### 18.9 Testing without git CLI

All fixture repos must be created programmatically using gix's write API (`repo.write_blob`,
`repo.write_tree`, `repo.write_commit`, etc.). This is enforced by `no_external_binaries.rs`
which scans for `std::process::Command` in src/. The `create_simple_repo`, `create_rename_repo`,
and `create_medium_repo` fixtures in `tests/common/fixture.rs` demonstrate the pattern.

### 18.10 Tree diff cancellation (gix Action::Cancel bug)

**Problem:** `gix::diff::tree()` treats `Action::Cancel` from the visitor as an error, not a
graceful early return. When the `ChangeCollector` hits its visit limit and returns `Action::Cancel`,
gix wraps it as `"The delegate cancelled the operation"` error. Naively treating this as a fatal
error causes workers to drop the commit entirely.

**Impact:** On ASP.NET Core (62K commits), only 3,977 commits were processed — 94% silently dropped.
The scan appeared to complete but produced wildly incorrect metrics.

**Solution:** Check `visitor.at_limit()` when `gix::diff::tree()` returns an error. If at limit,
the visitor's collected changes are valid partial results. Return them with `truncated: true`.
Only propagate the error if NOT at limit (genuine tree diff failure).

**Testing:** The `TreeDeltaResult` struct carries the `truncated` flag through to the worker's
`DiffResult.tree_truncated`, which the aggregator counts. A scan.log line like
`"247 truncated"` confirms the limit is working. Zero truncations on small repos.

### 18.11 Merge commit handling (tree limit strategy)

**Problem:** Merge commits can touch thousands of files (especially merges of long-lived branches).
On ASP.NET Core, some merge commits had 5K+ file changes. Processing these with line-level diff
consumed enormous time with little analytic value — the real changes are already captured by the
individual parent commits.

**Solution:** Two-tier tree limit:
- Normal commits: `max_diff_files` (default 1000)
- Merge commits: `min(max_diff_files, 100)`

When the tree diff is truncated (`tree_truncated = true`), the worker sets `skip_diff = true`:
all changes are marked binary (sentinel values), and rename/copy detection is skipped. The commit
is still counted in metrics, and the number of files changed is still recorded.

**Impact:** On ASP.NET Core, this reduced scan time from ~2743s to ~74s. The 100-file limit for
merges is generous — conflict resolution rarely touches more than a handful of files.

### 18.12 Parallel sizer with rayon

**Problem:** Single-threaded ODB iteration over 6.5M objects took ~37s. git-sizer does it in ~7.3s
(Go's concurrent GC + aggressive caching).

**Solution:** Parallel processing with rayon:
1. **Sequential collection:** `repo.objects.iter()` collects all OIDs into a `Vec<ObjectId>` (~1s).
   This is sequential because the iterator is not Send.
2. **Parallel processing:** `par_chunks(10_000)` distributes chunks to rayon's thread pool.
   Each chunk opens its own `gix::open()` with 64MB object cache and processes OIDs independently.
3. **Merge:** `ChunkResult::merge()` combines results — sum for counts, min/max for extremes,
   merge-and-truncate for top-N lists.

**Key design decisions:**
- Chunk size 10,000: balances parallelism overhead vs work granularity. Smaller chunks have too
  much overhead from `gix::open()`. Larger chunks underutilize cores.
- 64MB object cache per handle: enough for most pack lookups without excessive memory.
  Workers in the diff phase use 128MB; sizer uses less because it doesn't do subtree recursion.
- Blob size caching: Phase 1 builds `HashMap<ObjectId, u64>` of all blob sizes. Phase 2 (tree walk)
  uses this cache for checkout size computation instead of calling `find_header` again per blob.
- History depth from parent map: During Phase 1, commits populate a `HashMap<ObjectId, Vec<ObjectId>>`
  parent map. Phase 3 computes max history depth via iterative DFS with memoization — O(N) time,
  no second pass over the object database.

**Performance:** ODB scan dropped from ~37s to ~2.3s (16x speedup on 8 cores). Total sizer ~11.5s
vs git-sizer's ~7.3s. The remaining gap is in tree walk + history depth (still sequential).

### 18.13 Performance benchmarks (ASP.NET Core)

**Repository:** ASP.NET Core (62,067 commits, 385MB bare, 6.5M objects)
**Machine:** ARM64, 8 cores, NVMe, 8GB RAM

| Phase | Time | Notes |
|-------|------|-------|
| Open + refs | <0.1s | 2 tip refs |
| Revwalk + work items | 0.5s | 62K commits, 62K work items |
| Diff + aggregation | ~60s | 8 workers, 1.57M file changes |
| Sizer (parallel) | ~11.5s | 6.5M objects, rayon par_chunks |
| Report + write | ~2s | HTML + JSON + binary tables |
| **Total** | **~74s** | **Well under 5-minute target** |

**Memory:** Peak RSS ~2.2GB. Bounded by:
- Worker object caches: 8 × 128MB = 1GB
- Sizer blob size cache: ~150MB (6.5M × 28 bytes with HashMap overhead)
- Aggregator reorder buffer: ~50MB (bounded by channel capacity 256)

**Key metrics:**
- 62,067 commits processed (100%)
- 1,574,268 file changes
- 247 tree-truncated commits (0.4%)
- 0 diff bailouts (imara-diff histogram eliminates Myers bailouts)

**Before optimization:** Same repo took ~2,743s (45 minutes) due to:
1. gix cancellation treated as error → 94% commits dropped silently
2. `max_diff_files = 10000` → mega-commits not limited
3. No merge commit limit → merge diffs processed in full
4. Single-threaded sizer → 37s just for object scan

### 18.14 imara-diff vs hand-rolled Myers

**Problem:** Hand-rolled Myers O(ND) had two critical issues:
1. Trace storage (`Vec<Vec<usize>>`) consumed O(D × (N+M)) memory — 4.56GB peak on ASP.NET Core
2. Even after removing the trace, Myers had a 33% bailout rate (521K/1.57M file changes) on
   files with large edit distances

**Solution:** Switch to `imara-diff` crate with Histogram algorithm:
- Zero bailouts (histogram handles repeated content gracefully)
- 10-100% faster than Myers on typical code diffs
- Battle-tested: used by gitoxide itself
- API: `InternedInput::new(old, new)` → `imara_diff::diff(Algorithm::Histogram, &input, sink)`
- `Sink` implementation sums hunk sizes — no patch generation needed

**Impact:** Eliminated 521K bailouts, improved accuracy on all file changes. The `LineStats.bailed_out`
field and `BINARY_SENTINEL` values are retained for compatibility but should never trigger with
imara-diff histogram.


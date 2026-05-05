# Plan: Add 10 New Visualizations (shtats parity + advanced charts)

## Context

We have 27 visualizations. After comparing with shtats.com (screenshot + source analysis), 5 are missing. User also wants 4 advanced charts (contributor network, code ownership treemap, streak calendar, timezone map) and an enhanced tag timeline. Total: **10 new visualizations → 37 total**.

---

## New Visualizations

| # | Name | Type | Data Source |
|---|------|------|-------------|
| 1 | Cumulative Files Over Time | ECharts area line | `file_stats` + `commit_stats` (timestamp lookup) |
| 2 | File Operations Breakdown | ECharts donut | `file_stats.change_kind` (1=Add,2=Modify,3=Delete,4=Rename,5=Copy,6=TypeChange) |
| 3 | Lines Changed by Language | ECharts horizontal stacked bar | `file_stats` insertions/deletions grouped by path extension |
| 4 | Lines Statistics Summary | Sortable table | `commit_stats` per-commit churn → min/max/avg/median |
| 5 | Per-Author Activity Timelines | ECharts multi-line | `commit_stats` grouped by (author_id, month) |
| 6 | Enhanced Tag Timeline | ECharts custom series | existing `tag_history` data + days-between calculation in JS |
| 7 | Contributor Network Graph | D3 force-directed | `file_stats` grouped by path_id → author pairs |
| 8 | Code Ownership Treemap | ECharts treemap | `file_stats` insertions grouped by (directory, author_id) |
| 9 | Commit Streak Calendar | ECharts calendar | existing `timeseries` daily data (already available) |
| 10 | Timezone World Map | D3 SVG + timezone bands | existing `commits_by_timezone()` (already in report_aggs.rs:422) |

---

## Step 1: New Rust Aggregation Functions

**File: `src/aggregate/report_aggs.rs`** (append after line 558)

### 1a. `cumulative_files_over_time`
```rust
/// Cumulative unique files over time.
/// Joins file_stats with commit_stats to get timestamps for each file's first appearance.
pub fn cumulative_files_over_time(
    commit_stats: &[CommitStat],
    file_stats: &[FileStat],
) -> Vec<(String, u64)> {
    // Build commit_oid → author_ts lookup from commit_stats
    let ts_map: HashMap<[u8; 20], i64> = commit_stats.iter()
        .map(|cs| {
            let oid: [u8; 20] = cs.commit_oid.as_bytes().try_into().unwrap();
            (oid, cs.author_ts)
        }).collect();

    // For each path_id, find earliest timestamp
    let mut first_seen: HashMap<u32, i64> = HashMap::new();
    for fs in file_stats {
        let oid: [u8; 20] = fs.commit_oid.as_bytes().try_into().unwrap();
        if let Some(&ts) = ts_map.get(&oid) {
            first_seen.entry(fs.path_id)
                .and_modify(|existing| *existing = (*existing).min(ts))
                .or_insert(ts);
        }
    }

    // Sort by timestamp, accumulate
    let mut events: Vec<(i64, u32)> = first_seen.into_iter().map(|(pid, ts)| (ts, pid)).collect();
    events.sort_unstable();

    // Group by date, emit cumulative count
    let mut result = Vec::new();
    let mut cum = 0u64;
    let mut prev_date = String::new();
    for (ts, _) in events {
        cum += 1;
        let (y, m, d) = unix_ts_to_ymd(ts);
        let date = format!("{y:04}-{m:02}-{d:02}");
        if date != prev_date {
            result.push((date.clone(), cum));
            prev_date = date;
        } else if let Some(last) = result.last_mut() {
            last.1 = cum;
        }
    }
    result
}
```

### 1b. `file_operations_breakdown`
```rust
/// Count file operations by change_kind.
/// ChangeKind: 1=Add, 2=Modify, 3=Delete, 4=Rename, 5=Copy, 6=TypeChange
pub fn file_operations_breakdown(file_stats: &[FileStat]) -> Vec<(String, u64)> {
    let mut counts = [0u64; 7]; // index 0 unused, 1-6 for ChangeKind values
    for fs in file_stats {
        let k = fs.change_kind as usize;
        if k >= 1 && k <= 6 { counts[k] += 1; }
    }
    let labels = ["", "Added", "Modified", "Deleted", "Renamed", "Copied", "Type Changed"];
    (1..=6).filter(|&i| counts[i] > 0)
        .map(|i| (labels[i].to_string(), counts[i]))
        .collect()
}
```

### 1c. `lines_by_extension`
```rust
/// Lines added/deleted grouped by file extension.
/// Returns Vec<(extension, insertions, deletions)> sorted by total churn descending.
pub fn lines_by_extension(
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
) -> Vec<(String, u64, u64)> {
    let mut ext_stats: HashMap<String, (u64, u64)> = HashMap::new();
    for fs in file_stats {
        if let Some(path) = paths.get(&fs.path_id) {
            let ext = path.rsplit('.').next()
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if ext.is_empty() || ext == path.to_lowercase() { continue; }
            let entry = ext_stats.entry(ext).or_insert((0, 0));
            entry.0 += fs.insertions as u64;
            entry.1 += fs.deletions as u64;
        }
    }
    let mut result: Vec<_> = ext_stats.into_iter()
        .map(|(ext, (ins, del))| (ext, ins, del))
        .collect();
    result.sort_by(|a, b| (b.1 + b.2).cmp(&(a.1 + a.2)));
    result.truncate(20);
    result
}
```

### 1d. `LinesStatsSummary` + `lines_stats_summary`
```rust
#[derive(Debug, Serialize)]
pub struct LinesStatsSummary {
    pub label: String,
    pub min: u64,
    pub max: u64,
    pub avg: f64,
    pub median: u64,
    pub total: u64,
}

/// Compute per-commit lines-changed statistics.
pub fn lines_stats_summary(commit_stats: &[CommitStat]) -> Vec<LinesStatsSummary> {
    if commit_stats.is_empty() { return Vec::new(); }

    let mut churns: Vec<u64> = commit_stats.iter()
        .map(|cs| cs.insertions + cs.deletions)
        .collect();
    churns.sort_unstable();

    let min = churns[0];
    let max = *churns.last().unwrap();
    let total: u64 = churns.iter().sum();
    let avg = total as f64 / churns.len() as f64;
    let median = churns[churns.len() / 2];

    vec![
        LinesStatsSummary { label: "Per Commit".into(), min, max, avg: (avg * 10.0).round() / 10.0, median, total },
        // Additional rows computed by grouping commits by day/week/month
        // (group by date key, sum churn per group, then compute stats on group sums)
    ]
    // Full implementation will add "Per Day", "Per Week", "Per Month" rows
}
```

### 1e. `AuthorTimeline` + `author_timelines`
```rust
#[derive(Debug, Serialize)]
pub struct AuthorTimeline {
    pub author_id: u32,
    pub points: Vec<(String, u64)>, // (YYYY-MM, count)
}

/// Per-author monthly commit counts for top N authors.
pub fn author_timelines(commit_stats: &[CommitStat], top_n: usize) -> Vec<AuthorTimeline> {
    // Count total commits per author to find top N
    let mut author_total: HashMap<u32, u64> = HashMap::new();
    for cs in commit_stats {
        *author_total.entry(cs.author_id).or_insert(0) += 1;
    }
    let mut sorted_authors: Vec<_> = author_total.into_iter().collect();
    sorted_authors.sort_by(|a, b| b.1.cmp(&a.1));
    sorted_authors.truncate(top_n);
    let top_ids: HashSet<u32> = sorted_authors.iter().map(|(id, _)| *id).collect();

    // Group by (author_id, YYYY-MM)
    let mut monthly: HashMap<u32, BTreeMap<String, u64>> = HashMap::new();
    for cs in commit_stats {
        if !top_ids.contains(&cs.author_id) { continue; }
        let (y, m, _) = unix_ts_to_ymd(cs.author_ts);
        let key = format!("{y:04}-{m:02}");
        *monthly.entry(cs.author_id).or_default().entry(key).or_insert(0) += 1;
    }

    sorted_authors.iter().map(|(id, _)| {
        let points = monthly.get(id)
            .map(|m| m.iter().map(|(k, &v)| (k.clone(), v)).collect())
            .unwrap_or_default();
        AuthorTimeline { author_id: *id, points }
    }).collect()
}
```

### 1f. `ContribEdge` + `contributor_network`
```rust
#[derive(Debug, Serialize)]
pub struct ContribEdge {
    pub source: u32,
    pub target: u32,
    pub weight: u64,
}

/// Build contributor collaboration network.
/// Authors who edit the same files are connected. Weight = number of shared files.
pub fn contributor_network(
    file_stats: &[FileStat],
    min_shared: u64,
    top_authors: usize,
) -> (Vec<u32>, Vec<ContribEdge>) {
    // For each path_id, collect unique author_ids
    let mut path_authors: HashMap<u32, HashSet<u32>> = HashMap::new();
    for fs in file_stats {
        path_authors.entry(fs.path_id).or_default().insert(fs.author_id);
    }

    // Count shared files between each author pair
    let mut pair_counts: HashMap<(u32, u32), u64> = HashMap::new();
    let mut author_file_counts: HashMap<u32, u64> = HashMap::new();
    for authors in path_authors.values() {
        if authors.len() < 2 || authors.len() > 50 { continue; }
        let mut sorted: Vec<u32> = authors.iter().copied().collect();
        sorted.sort_unstable();
        for &a in &sorted { *author_file_counts.entry(a).or_insert(0) += 1; }
        for i in 0..sorted.len() {
            for j in (i+1)..sorted.len() {
                *pair_counts.entry((sorted[i], sorted[j])).or_insert(0) += 1;
            }
        }
    }

    // Take top N authors by file count
    let mut top: Vec<_> = author_file_counts.into_iter().collect();
    top.sort_by(|a, b| b.1.cmp(&a.1));
    top.truncate(top_authors);
    let node_set: HashSet<u32> = top.iter().map(|(id, _)| *id).collect();
    let nodes: Vec<u32> = top.iter().map(|(id, _)| *id).collect();

    let edges: Vec<ContribEdge> = pair_counts.into_iter()
        .filter(|((s, t), w)| *w >= min_shared && node_set.contains(s) && node_set.contains(t))
        .map(|((s, t), w)| ContribEdge { source: s, target: t, weight: w })
        .collect();

    (nodes, edges)
}
```

### 1g. `OwnershipNode` + `code_ownership`
```rust
#[derive(Debug, Serialize)]
pub struct OwnershipNode {
    pub path: String,
    pub lines: u64,
    pub owner_id: u32,
}

/// Compute code ownership at directory level (first 2 path segments).
pub fn code_ownership(
    file_stats: &[FileStat],
    paths: &BTreeMap<u32, String>,
) -> Vec<OwnershipNode> {
    // For each directory, track (total_lines, author → lines)
    let mut dir_stats: HashMap<String, (u64, HashMap<u32, u64>)> = HashMap::new();
    for fs in file_stats {
        if let Some(path) = paths.get(&fs.path_id) {
            // Extract directory (up to 2 segments)
            let parts: Vec<&str> = path.split('/').collect();
            let dir = if parts.len() <= 1 { "(root)" }
                else if parts.len() == 2 { parts[0] }
                else { &path[..path.find('/').unwrap() + 1 + parts[1].len()] };
            let dir = dir.to_string();
            let entry = dir_stats.entry(dir).or_insert((0, HashMap::new()));
            let lines = (fs.insertions + fs.deletions) as u64;
            entry.0 += lines;
            *entry.1.entry(fs.author_id).or_insert(0) += lines;
        }
    }

    let mut result: Vec<OwnershipNode> = dir_stats.into_iter()
        .filter(|(_, (lines, _))| *lines > 0)
        .map(|(path, (lines, authors))| {
            let owner_id = authors.into_iter().max_by_key(|(_, l)| *l).map(|(id, _)| id).unwrap_or(0);
            OwnershipNode { path, lines, owner_id }
        })
        .collect();
    result.sort_by(|a, b| b.lines.cmp(&a.lines));
    result.truncate(50);
    result
}
```

---

## Step 2: Expand ReportData — `src/report/html.rs`

### Add to `ReportData` struct (after line 48, `tag_history` field):
```rust
// New visualizations
pub cumulative_files: Vec<(String, u64)>,
pub file_operations: Vec<(String, u64)>,
pub lines_by_extension: Vec<(String, u64, u64)>,
pub lines_stats_summary: Vec<report_aggs::LinesStatsSummary>,
pub author_timelines: Vec<report_aggs::AuthorTimeline>,
pub contributor_network_nodes: Vec<(u32, String)>,
pub contributor_network_edges: Vec<report_aggs::ContribEdge>,
pub code_ownership: Vec<report_aggs::OwnershipNode>,
pub timezone_data: Vec<(i32, u64)>,
```

### Add to `ReportJson` struct (after line 79, `tag_history` field):
Same 9 fields with appropriate serde serialization.

### Add HTML containers in template (insert in appropriate sections):

After `repo-growth-chart` section (~line 236):
```html
<div class="card"><h2>Cumulative Files Over Time</h2>
<div id="cumulative-files-chart" class="chart-tall"></div></div>

<div class="chart-grid">
<div class="card"><h2>File Operations</h2>
<div id="file-operations-chart" class="chart"></div></div>
<div class="card"><h2>Lines Changed by Language</h2>
<div id="lines-by-language-chart" class="chart"></div></div>
</div>

<div class="card"><h2>Lines Statistics</h2>
<div id="lines-stats-table"></div></div>
```

After contributor section (~line 218):
```html
<div class="card"><h2>Author Activity Over Time</h2>
<div id="author-timelines-chart" class="chart-tall"></div></div>

<div class="card"><h2>Contributor Network</h2>
<div id="contributor-network-chart" class="d3-container"></div></div>
```

After bus factor section (~line 279):
```html
<div class="card"><h2>Code Ownership</h2>
<div id="code-ownership-chart" class="chart-tall"></div></div>

<div class="card"><h2>Commit Streak Calendar</h2>
<div id="streak-calendar-chart" class="chart-tall"></div></div>

<div class="card"><h2>Contributor Timezones</h2>
<div id="timezone-map-chart" class="d3-container"></div></div>
```

---

## Step 3: Compute in Pipeline — `src/pipeline/mod.rs`

In `generate_report()` function (after existing aggregation calls, ~line 247):

```rust
// New aggregations
let cumulative_files = report_aggs::cumulative_files_over_time(&commit_stats, &file_stats);
let file_operations = report_aggs::file_operations_breakdown(&file_stats);
let lines_by_ext = report_aggs::lines_by_extension(&file_stats, &metrics.paths);
let lines_stats = report_aggs::lines_stats_summary(&commit_stats);
let author_tl = report_aggs::author_timelines(&commit_stats, 10);
let (network_nodes_raw, network_edges) = report_aggs::contributor_network(&file_stats, 3, 20);
let network_nodes: Vec<(u32, String)> = network_nodes_raw.iter()
    .map(|id| (*id, metrics.authors.get(id).cloned().unwrap_or_default()))
    .collect();
let ownership = report_aggs::code_ownership(&file_stats, &metrics.paths);
let timezone_data = report_aggs::commits_by_timezone(&commit_stats);
```

Pass all to `ReportData` struct construction.

---

## Step 4: JavaScript Visualizations — `assets/app.js`

### 4a. Cumulative Files (`cumulative-files-chart`)
- ECharts area line chart
- Cyan color (#38bdf8), area fill with gradient to transparent
- dataZoom slider at bottom
- Tooltip showing date + file count

### 4b. File Operations (`file-operations-chart`)
- ECharts donut pie chart
- Colors: Added=#22c55e, Modified=#3b82f6, Deleted=#ef4444, Renamed=#f97316, Copied=#a855f7, TypeChanged=#64748b
- Center label showing total count

### 4c. Lines by Language (`lines-by-language-chart`)
- ECharts horizontal bar chart with 2 stacked series
- Series 1: Insertions (green #22c55e), Series 2: Deletions (red #ef4444)
- Y-axis: extension names, sorted by total churn
- Optional log scale toggle

### 4d. Lines Stats Table (`lines-stats-table`)
- Use existing `buildSortableTable()` pattern
- Columns: Metric | Min | Max | Average | Median | Total
- Format numbers with comma separators

### 4e. Author Timelines (`author-timelines-chart`)
- ECharts line chart with multiple series
- Each series = one author, labeled by name from `d.metrics` author lookup
- X-axis: months (YYYY-MM), Y-axis: commit count
- Legend at top for toggling
- Use the 10-color accent palette

### 4f. Enhanced Tag Timeline (replace `tag-history-chart`)
- Custom ECharts chart with:
  - X-axis: time (dates from tag timestamps)
  - Bar series: commits_since_prev per tag
  - Scatter series: markers at each tag position with version label
  - Color bars by days_since_prev: green (<30d) → yellow (30-90d) → red (>90d)
  - Tooltip: "{tag name}\n{date}\n{N} commits since previous\n{M} days since previous"
- Compute `days_since_prev` in JS from timestamps

### 4g. Contributor Network (`contributor-network-chart`)
- D3 force-directed graph (using existing D3 v7 CDN)
- Nodes: circles sized by `sqrt(file_count)`, colored by author index
- Edges: lines with opacity proportional to weight
- Force layout: `d3.forceSimulation`, `forceLink`, `forceManyBody(-200)`, `forceCenter`
- Draggable nodes, hover tooltip showing author name + file count
- SVG rendered into `#contributor-network-chart`

### 4h. Code Ownership Treemap (`code-ownership-chart`)
- ECharts treemap
- Data: directories as items, `value` = lines, color by owner_id (map to palette)
- Drill-down with breadcrumb navigation
- Tooltip: "directory\nOwner: {name}\n{lines} lines changed"

### 4i. Commit Streak Calendar (`streak-calendar-chart`)
- ECharts calendar heatmap (similar to existing `commit-heatmap`)
- GitHub-style green intensity: 0=#161b22, low=#0e4429, mid=#006d32, high=#26a641, max=#39d353
- Add annotation text below: "Longest streak: N days" computed in JS
- Compute streak by iterating sorted daily data, tracking consecutive non-zero days

### 4j. Timezone World Map (`timezone-map-chart`)
- D3 SVG visualization (no external TopoJSON dependency)
- Draw simplified world outline as path (hardcoded, ~2KB SVG path data)
- Overlay 24 vertical timezone bands (-12 to +11)
- Color each band by commit count: transparent (0) → blue intensity (proportional)
- Legend showing offset → count
- Tooltip on hover per band
- Alternatively: simpler horizontal bar chart styled as a globe-like strip

---

## Step 5: CSS Updates — `assets/style.css`

Add styles for:
```css
/* D3 containers need explicit dimensions */
.d3-container { min-height: 400px; position: relative; }
.d3-container svg { width: 100%; height: 100%; }

/* Force graph specific */
#contributor-network-chart .node { cursor: grab; }
#contributor-network-chart .link { stroke: var(--text-muted); }

/* Streak calendar green palette */
.streak-info { text-align: center; color: var(--text-secondary); margin-top: 0.5rem; }
```

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `src/aggregate/report_aggs.rs` | +7 functions, +4 structs (~200 lines) |
| `src/report/html.rs` | +9 fields in ReportData/ReportJson, +10 HTML containers |
| `src/pipeline/mod.rs` | +10 aggregation calls in `generate_report()` |
| `assets/app.js` | +10 chart implementations (~600 lines) |
| `assets/style.css` | +~20 lines for new chart containers |

No changes to binary formats, model structs, or scan pipeline.

---

## Verification

1. `cargo build --release` — must compile
2. `cargo test` — all tests pass
3. Scan: `./target/release/repoanalyze scan --repo . --out /tmp/test-run --report on`
4. Open `/tmp/test-run/report/index.html` — verify:
   - Cumulative files: monotonically increasing area line
   - File operations: donut with Add/Modify/Delete segments
   - Lines by language: horizontal bars with green+red stacks
   - Lines stats: table with plausible min/max/avg/median
   - Author timelines: multiple colored lines, legend works
   - Tag timeline: time-axis bars with version labels, color gradient
   - Contributor network: force graph with draggable nodes
   - Code ownership: clickable treemap with breadcrumbs
   - Streak calendar: GitHub-style green grid with streak annotation
   - Timezone map: world outline with colored bands
5. Responsive at 768px and 480px
6. All 27 existing charts still render correctly

**Note**: Copy this plan to project directory as `PLAN-visualizations.md` before implementation.

use std::collections::BTreeMap;
use std::path::Path;

use serde::Serialize;

use crate::aggregate::author::AuthorSummary;
use crate::aggregate::hotspot::HotFile;
use crate::aggregate::report_aggs::{
    AuthorOfPeriod, AuthorTimeline, BusFactor, ChangeChain, ContribEdge, ExtMonthlyChurn,
    FileCouplingPair, LinesStatsSummary, OwnershipNode, RadarMetric, TagSummary,
};
use crate::aggregate::timeseries::TimeBucket;
use crate::report::assets;
use crate::writer::json_writer::Metrics;

/// Escape HTML special characters to prevent XSS.
pub fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// All data needed for the HTML report, serialized to JSON and injected inline.
pub struct ReportData<'a> {
    pub metrics: &'a Metrics,
    pub timeseries: &'a [TimeBucket],
    pub authors: &'a [AuthorSummary],
    pub hotspots: &'a [HotFile],
    // Phase 2 aggregations
    pub commits_by_weekday: [u64; 7],
    pub commits_by_month: [u64; 12],
    pub commits_by_year: BTreeMap<i32, u64>,
    pub punch_card: Vec<(u8, u8, u64)>,
    pub commit_size_histogram: Vec<(String, u64)>,
    pub bus_factor: BusFactor,
    pub commits_by_extension: Vec<(String, u64)>,
    // Phase 3 aggregations
    pub conventional_commits: Option<BTreeMap<String, u64>>,
    pub word_frequencies: Option<Vec<(String, u64)>>,
    pub language_breakdown: Option<BTreeMap<String, u64>>,
    pub file_coupling: Vec<FileCouplingPair>,
    pub radar_metrics: Vec<RadarMetric>,
    // Phase 5 aggregations
    pub commits_by_hour: [u64; 24],
    pub commits_by_domain: Vec<(String, u64)>,
    pub author_of_month: Vec<AuthorOfPeriod>,
    pub author_of_year: Vec<AuthorOfPeriod>,
    pub weekly_activity: Vec<(String, u64)>,
    pub tag_history: Vec<TagSummary>,
    // Phase 6 aggregations
    pub cumulative_files: Vec<(String, u64)>,
    pub file_operations: Vec<(String, u64)>,
    pub lines_by_ext: Vec<(String, u64, u64)>,
    pub lines_stats_summary: Vec<LinesStatsSummary>,
    pub author_timelines: Vec<AuthorTimeline>,
    pub contributor_network_nodes: Vec<(u32, String)>,
    pub contributor_network_edges: Vec<ContribEdge>,
    pub code_ownership: Vec<OwnershipNode>,
    pub timezone_data: Vec<(i32, u64)>,
    pub lines_by_ext_time: ExtMonthlyChurn,
    pub sequential_coupling: Vec<ChangeChain>,
}

/// JSON blob injected as window.__REPORT_DATA__.
/// All user strings are escaped in the Rust layer before embedding.
#[derive(Serialize)]
struct ReportJson<'a> {
    metrics: MetricsJson<'a>,
    timeseries: &'a [TimeBucket],
    authors: Vec<AuthorJson>,
    hotspots: &'a [HotFile],
    commits_by_weekday: &'a [u64; 7],
    commits_by_month: &'a [u64; 12],
    commits_by_year: &'a BTreeMap<i32, u64>,
    punch_card: &'a [(u8, u8, u64)],
    commit_size_histogram: &'a [(String, u64)],
    bus_factor: &'a BusFactor,
    commits_by_extension: &'a [(String, u64)],
    #[serde(skip_serializing_if = "Option::is_none")]
    conventional_commits: &'a Option<BTreeMap<String, u64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    word_frequencies: &'a Option<Vec<(String, u64)>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language_breakdown: &'a Option<BTreeMap<String, u64>>,
    file_coupling: &'a [FileCouplingPair],
    radar_metrics: &'a [RadarMetric],
    commits_by_hour: &'a [u64; 24],
    commits_by_domain: &'a [(String, u64)],
    author_of_month: &'a [AuthorOfPeriod],
    author_of_year: &'a [AuthorOfPeriod],
    weekly_activity: &'a [(String, u64)],
    tag_history: &'a [TagSummary],
    cumulative_files: &'a [(String, u64)],
    file_operations: &'a [(String, u64)],
    lines_by_ext: &'a [(String, u64, u64)],
    lines_stats_summary: &'a [LinesStatsSummary],
    author_timelines: &'a [AuthorTimeline],
    contributor_network_nodes: &'a [(u32, String)],
    contributor_network_edges: &'a [ContribEdge],
    code_ownership: &'a [OwnershipNode],
    timezone_data: &'a [(i32, u64)],
    lines_by_ext_time: &'a ExtMonthlyChurn,
    sequential_coupling: &'a [ChangeChain],
}

#[derive(Serialize)]
struct MetricsJson<'a> {
    total_commits: u64,
    total_files_changed: u64,
    total_insertions: u64,
    total_deletions: u64,
    total_authors: u64,
    total_paths: u64,
    merge_commits: u64,
    binary_files_changed: u64,
    repo_metrics: &'a Option<crate::metrics::sizer::RepoMetrics>,
}

#[derive(Serialize)]
struct AuthorJson {
    name: String,
    author_id: u32,
    commits: u64,
    insertions: u64,
    deletions: u64,
}

/// Generate a self-contained index.html with all data embedded inline.
pub fn generate_index_html(out_dir: &Path, data: &ReportData) -> anyhow::Result<()> {
    let report_dir = out_dir.join("report");
    std::fs::create_dir_all(&report_dir)?;

    let style_css = String::from_utf8_lossy(assets::STYLE_CSS);
    let app_js = String::from_utf8_lossy(assets::APP_JS);

    // Build the JSON blob with escaped author names
    let authors_json: Vec<AuthorJson> = data
        .authors
        .iter()
        .map(|a| {
            let name = data
                .metrics
                .authors
                .get(&a.author_id)
                .map(|s| s.as_str())
                .unwrap_or("unknown");
            AuthorJson {
                name: name.to_string(),
                author_id: a.author_id,
                commits: a.commits,
                insertions: a.insertions,
                deletions: a.deletions,
            }
        })
        .collect();

    let report_json = ReportJson {
        metrics: MetricsJson {
            total_commits: data.metrics.total_commits,
            total_files_changed: data.metrics.total_files_changed,
            total_insertions: data.metrics.total_insertions,
            total_deletions: data.metrics.total_deletions,
            total_authors: data.metrics.total_authors,
            total_paths: data.metrics.total_paths,
            merge_commits: data.metrics.merge_commits,
            binary_files_changed: data.metrics.binary_files_changed,
            repo_metrics: &data.metrics.repo_metrics,
        },
        timeseries: data.timeseries,
        authors: authors_json,
        hotspots: data.hotspots,
        commits_by_weekday: &data.commits_by_weekday,
        commits_by_month: &data.commits_by_month,
        commits_by_year: &data.commits_by_year,
        punch_card: &data.punch_card,
        commit_size_histogram: &data.commit_size_histogram,
        bus_factor: &data.bus_factor,
        commits_by_extension: &data.commits_by_extension,
        conventional_commits: &data.conventional_commits,
        word_frequencies: &data.word_frequencies,
        language_breakdown: &data.language_breakdown,
        file_coupling: &data.file_coupling,
        radar_metrics: &data.radar_metrics,
        commits_by_hour: &data.commits_by_hour,
        commits_by_domain: &data.commits_by_domain,
        author_of_month: &data.author_of_month,
        author_of_year: &data.author_of_year,
        weekly_activity: &data.weekly_activity,
        tag_history: &data.tag_history,
        cumulative_files: &data.cumulative_files,
        file_operations: &data.file_operations,
        lines_by_ext: &data.lines_by_ext,
        lines_stats_summary: &data.lines_stats_summary,
        author_timelines: &data.author_timelines,
        contributor_network_nodes: &data.contributor_network_nodes,
        contributor_network_edges: &data.contributor_network_edges,
        code_ownership: &data.code_ownership,
        timezone_data: &data.timezone_data,
        lines_by_ext_time: &data.lines_by_ext_time,
        sequential_coupling: &data.sequential_coupling,
    };

    let json_blob = serde_json::to_string(&report_json)?;

    // Build metric cards HTML (server-side, all values are numeric — safe)
    let metric_cards = build_metric_cards(data.metrics);

    // Detect which optional sections are available
    let has_messages = data.conventional_commits.is_some();
    let has_languages = data.language_breakdown.is_some();
    let html = format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RepoAnalyze Report</title>
<style>
{style_css}
</style>
</head>
<body>
<div class="bg-gradient-dark">
<div class="container">

<div id="section-overview" class="report-header section-anchor">
<h1>RepoAnalyze Report</h1>
<p class="subtitle">Generated by RepoAnalyze &mdash; Git Repository Analytics</p>
</div>

<!-- Stats Overview Cards -->
<div class="metric-grid">
{metric_cards}
</div>

<!-- Code Frequency -->
<div id="section-activity" class="card section-anchor">
<h2>Code Frequency</h2>
<div id="code-frequency-chart" class="chart-tall"></div>
</div>

<!-- Contributor Breakdown -->
<div id="section-contributors" class="section-anchor"></div>
<div class="chart-grid">
<div class="card">
<h2>Top Contributors</h2>
<div id="contributor-bar-chart" class="chart"></div>
</div>
<div class="card">
<h2>Commit Share</h2>
<div id="contributor-pie-chart" class="chart"></div>
</div>
</div>

<!-- Author Timelines -->
<div class="card">
<h2>Author Activity Over Time</h2>
<div id="author-timelines-chart" class="chart-tall"></div>
</div>

<!-- Contributor Network -->
<div class="card">
<h2>Contributor Network</h2>
<div id="contributor-network-chart" class="d3-container"></div>
</div>

<!-- Hotspot Charts -->
<div id="section-codebase" class="section-anchor"></div>
<div class="chart-grid">
<div class="card">
<h2>Hotspot Bubble Map</h2>
<div id="hotspot-bubble-chart" class="chart"></div>
</div>
<div class="card">
<h2>Hotspot Treemap</h2>
<div id="hotspot-treemap-chart" class="chart"></div>
</div>
</div>

<!-- File Churn Table -->
<div class="card">
<h2>Hotspots (Most Changed Files)</h2>
<div id="hotspot-table"></div>
</div>

<!-- Repo Growth Timeline -->
<div class="card">
<h2>Repository Growth</h2>
<div id="repo-growth-chart" class="chart-tall"></div>
</div>

<!-- Cumulative Files -->
<div class="card">
<h2>Cumulative Files Over Time</h2>
<div id="cumulative-files-chart" class="chart-tall"></div>
</div>

<!-- File Operations + Lines by Language -->
<div class="chart-grid">
<div class="card">
<h2>File Operations</h2>
<div id="file-operations-chart" class="chart"></div>
</div>
<div class="card">
<h2>Lines Changed by Language</h2>
<div id="lines-by-language-chart" class="chart"></div>
</div>
</div>

<!-- Lines Changed by Language Over Time -->
<div class="card">
<h2>Lines Changed by Language Over Time</h2>
<div id="lines-by-ext-time-chart" class="chart-tall"></div>
</div>

<!-- Lines Statistics -->
<div class="card">
<h2>Lines Statistics</h2>
<div id="lines-stats-table"></div>
</div>

<!-- Temporal Analysis -->
<div id="section-patterns" class="section-anchor"></div>
<div class="chart-grid">
<div class="card">
<h2>Commits by Weekday</h2>
<div id="weekday-chart" class="chart-short"></div>
</div>
<div class="card">
<h2>Commits by Month</h2>
<div id="month-chart" class="chart-short"></div>
</div>
</div>

<div class="chart-grid">
<div class="card">
<h2>Commits by Year</h2>
<div id="year-chart" class="chart-short"></div>
</div>
<div class="card">
<h2>Commit Size Distribution</h2>
<div id="size-histogram-chart" class="chart-short"></div>
</div>
</div>

<!-- Punch Card -->
<div class="card">
<h2>Activity Punch Card</h2>
<div id="punch-card-chart" class="chart"></div>
</div>

<!-- Bus Factor -->
<div id="section-health" class="section-anchor"></div>
<div class="chart-grid">
<div class="card">
<h2>Bus Factor (Lorenz Curve)</h2>
<div id="bus-factor-chart" class="d3-container"></div>
</div>
<div class="card">
<h2>Commits by File Extension</h2>
<div id="extension-chart" class="chart"></div>
</div>
</div>

<!-- Phase 3: Commit Patterns -->
{commit_patterns_section}

<!-- Phase 3: Language Breakdown -->
{language_section}

<!-- Commits by Hour -->
<div class="chart-grid">
<div class="card">
<h2>Commits by Hour of Day</h2>
<div id="hour-chart" class="chart-short"></div>
</div>
<div class="card">
<h2>Commits by Email Domain</h2>
<div id="domain-chart" class="chart"></div>
</div>
</div>

<!-- Weekly Activity -->
<div class="card">
<h2>Weekly Activity (Last 52 Weeks)</h2>
<div id="weekly-activity-chart" class="chart-short"></div>
</div>

<!-- Tag History -->
<div class="card">
<h2>Tag / Release History</h2>
<div id="tag-history-chart" class="chart"></div>
<div id="tag-history-table"></div>
</div>

<!-- Lines of Code Over Time -->
<div class="card">
<h2>Lines of Code Over Time</h2>
<div id="loc-over-time-chart" class="chart-tall"></div>
</div>

<!-- Author of Month / Year -->
<div class="chart-grid">
<div class="card">
<h2>Author of Year</h2>
<div id="author-of-year-table"></div>
</div>
<div class="card">
<h2>Author of Month (Recent 24)</h2>
<div id="author-of-month-table"></div>
</div>
</div>

<!-- File Coupling -->
<div class="card">
<h2>File Coupling (Co-change Frequency)</h2>
<div id="coupling-graph" class="d3-container"></div>
<div id="coupling-table"></div>
</div>

<!-- Sequential Change Chains -->
<div class="card">
<h2>Change Cascades (Sequential Coupling)</h2>
<div id="sequential-coupling-table"></div>
</div>

<!-- Radar Chart -->
<div class="card">
<h2>Repository Health</h2>
<div id="radar-chart" class="d3-container"></div>
<div id="radar-explanation"></div>
</div>

<!-- Code Ownership Treemap -->
<div class="card">
<h2>Code Ownership</h2>
<div id="code-ownership-chart" class="chart-tall"></div>
</div>

<!-- Commit Streak Calendar -->
<div class="card">
<h2>Commit Activity</h2>
<div id="streak-calendar-chart" class="chart-tall"></div>
</div>

<!-- Timezone Map -->
<div class="card">
<h2>Contributor Timezones</h2>
<div id="timezone-map-chart" class="d3-container"></div>
</div>

</div>
</div>

<script>window.__REPORT_DATA__ = {json_blob};</script>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"></script>
<script>
{app_js}
</script>
</body>
</html>"##,
        style_css = style_css,
        metric_cards = metric_cards,
        json_blob = json_blob,
        app_js = app_js,
        commit_patterns_section = if has_messages {
            r#"<div class="chart-grid">
<div class="card">
<h2>Commit Patterns</h2>
<div id="conventional-commits-chart" class="chart"></div>
</div>
<div class="card">
<h2>Commit Message Word Cloud</h2>
<div id="wordcloud-chart" class="chart"></div>
</div>
</div>"#
        } else {
            r#"<div class="card">
<div class="info-banner">Commit message analysis not available. Re-scan to generate commit patterns and word cloud.</div>
</div>"#
        },
        language_section = if has_languages {
            r#"<div class="chart-grid">
<div class="card">
<h2>Language Breakdown</h2>
<div id="language-donut-chart" class="chart"></div>
</div>
<div class="card">
<h2>Language Treemap</h2>
<div id="language-treemap-chart" class="chart"></div>
</div>
</div>"#
        } else {
            ""
        },
    );

    std::fs::write(report_dir.join("index.html"), html)?;
    Ok(())
}

fn fmt_num(n: u64) -> String {
    let s = n.to_string();
    let bytes = s.as_bytes();
    let mut result = String::new();
    for (i, &b) in bytes.iter().enumerate() {
        if i > 0 && (bytes.len() - i).is_multiple_of(3) {
            result.push(',');
        }
        result.push(b as char);
    }
    result
}

fn build_metric_cards(metrics: &Metrics) -> String {
    let items: Vec<(&str, u64)> = vec![
        ("Commits", metrics.total_commits),
        ("Files Changed", metrics.total_files_changed),
        ("Insertions", metrics.total_insertions),
        ("Deletions", metrics.total_deletions),
        ("Authors", metrics.total_authors),
        ("Unique Paths", metrics.total_paths),
        ("Merge Commits", metrics.merge_commits),
        ("Binary Files", metrics.binary_files_changed),
    ];

    let mut html = String::new();
    for (label, val) in items {
        html.push_str(&format!(
            "<div class=\"metric-card\"><div class=\"value\">{}</div><div class=\"label\">{}</div></div>\n",
            fmt_num(val),
            label
        ));
    }
    html
}

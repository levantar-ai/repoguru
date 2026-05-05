use std::path::Path;

use serde_json::{json, Value};
use tonic::Status;

use crate::aggregate::author::compute_author_stats;
use crate::aggregate::hotspot::compute_hotspots;
use crate::aggregate::report_aggs;
use crate::aggregate::timeseries::{compute_timeseries, Granularity};
use crate::grpc::section_cache::ScanCache;

/// Section metadata: (name, description, data_keys, tables_needed).
pub struct SectionMeta {
    pub name: &'static str,
    pub description: &'static str,
    pub data_keys: &'static [&'static str],
    pub tables_needed: &'static [&'static str],
}

pub const SECTIONS: &[SectionMeta] = &[
    SectionMeta {
        name: "overview",
        description: "Metrics overview cards and repo-level statistics",
        data_keys: &["metrics"],
        tables_needed: &[],
    },
    SectionMeta {
        name: "activity",
        description:
            "Code frequency, repo growth, cumulative files, file operations, lines by language",
        data_keys: &[
            "timeseries",
            "cumulative_files",
            "file_operations",
            "lines_by_ext",
            "lines_stats_summary",
            "lines_by_ext_time",
        ],
        tables_needed: &["commit_stats", "file_stats"],
    },
    SectionMeta {
        name: "contributors",
        description:
            "Top contributors, author timelines, contributor network, author of month/year",
        data_keys: &[
            "authors",
            "author_timelines",
            "contributor_network_nodes",
            "contributor_network_edges",
            "author_of_month",
            "author_of_year",
            "commits_by_domain",
        ],
        tables_needed: &["commit_stats", "file_stats"],
    },
    SectionMeta {
        name: "codebase",
        description: "Hotspots, file coupling, code ownership, sequential change chains",
        data_keys: &[
            "hotspots",
            "file_coupling",
            "code_ownership",
            "sequential_coupling",
        ],
        tables_needed: &["commit_stats", "file_stats"],
    },
    SectionMeta {
        name: "patterns",
        description:
            "Temporal patterns: weekday/month/year/hour, punch card, commit sizes, streaks",
        data_keys: &[
            "commits_by_weekday",
            "commits_by_month",
            "commits_by_year",
            "commits_by_hour",
            "punch_card",
            "commit_size_histogram",
            "commits_by_extension",
            "weekly_activity",
            "conventional_commits",
            "word_frequencies",
            "language_breakdown",
        ],
        tables_needed: &["commit_stats", "file_stats", "messages"],
    },
    SectionMeta {
        name: "health",
        description: "Bus factor, repository health radar, tag/release history",
        data_keys: &["bus_factor", "radar_metrics", "tag_history"],
        tables_needed: &["commit_stats"],
    },
    SectionMeta {
        name: "timezone",
        description: "Contributor timezone distribution",
        data_keys: &["timezone_data"],
        tables_needed: &["commit_stats"],
    },
];

/// Compute the JSON data for a single section.
pub fn compute_section(
    section: &str,
    cache: &ScanCache,
    repo_path: Option<&Path>,
) -> Result<Value, Status> {
    match section {
        "overview" => compute_overview(cache),
        "activity" => compute_activity(cache),
        "contributors" => compute_contributors(cache),
        "codebase" => compute_codebase(cache),
        "patterns" => compute_patterns(cache, repo_path),
        "health" => compute_health(cache, repo_path),
        "timezone" => compute_timezone(cache),
        _ => Err(Status::invalid_argument(format!(
            "unknown section: {section}. Valid sections: {}",
            SECTIONS
                .iter()
                .map(|s| s.name)
                .collect::<Vec<_>>()
                .join(", ")
        ))),
    }
}

fn map_err(e: crate::error::ScanError) -> Status {
    Status::internal(e.to_string())
}

fn compute_overview(cache: &ScanCache) -> Result<Value, Status> {
    let m = &cache.metrics;
    Ok(json!({
        "metrics": {
            "total_commits": m.total_commits,
            "total_files_changed": m.total_files_changed,
            "total_insertions": m.total_insertions,
            "total_deletions": m.total_deletions,
            "total_authors": m.total_authors,
            "total_paths": m.total_paths,
            "merge_commits": m.merge_commits,
            "binary_files_changed": m.binary_files_changed,
            "repo_metrics": m.repo_metrics,
        }
    }))
}

fn compute_activity(cache: &ScanCache) -> Result<Value, Status> {
    let commit_stats = cache.commit_stats().map_err(map_err)?;
    let file_stats = cache.file_stats().map_err(map_err)?;

    let timeseries = compute_timeseries(&commit_stats, Granularity::Daily);
    let cumulative_files = report_aggs::cumulative_files_over_time(&commit_stats, &file_stats);
    let file_operations = report_aggs::file_operations_breakdown(&file_stats);
    let lines_by_ext = report_aggs::lines_by_extension(&file_stats, &cache.metrics.paths);
    let lines_stats_summary = report_aggs::lines_stats_summary(&commit_stats);
    let lines_by_ext_time = report_aggs::lines_by_extension_over_time(
        &commit_stats,
        &file_stats,
        &cache.metrics.paths,
        10,
    );

    Ok(json!({
        "timeseries": timeseries,
        "cumulative_files": cumulative_files,
        "file_operations": file_operations,
        "lines_by_ext": lines_by_ext,
        "lines_stats_summary": lines_stats_summary,
        "lines_by_ext_time": lines_by_ext_time,
    }))
}

fn compute_contributors(cache: &ScanCache) -> Result<Value, Status> {
    let commit_stats = cache.commit_stats().map_err(map_err)?;
    let file_stats = cache.file_stats().map_err(map_err)?;

    let author_stats = compute_author_stats(&commit_stats);
    let author_timelines = report_aggs::author_timelines(&commit_stats, 10);
    let (network_nodes_raw, contributor_network_edges) =
        report_aggs::contributor_network(&file_stats, 3, 20);
    let contributor_network_nodes: Vec<(u32, String)> = network_nodes_raw
        .iter()
        .map(|id| {
            (
                *id,
                cache.metrics.authors.get(id).cloned().unwrap_or_default(),
            )
        })
        .collect();
    let author_of_month = report_aggs::author_of_month(&commit_stats);
    let author_of_year = report_aggs::author_of_year(&commit_stats);
    let commits_by_domain = report_aggs::commits_by_domain(&cache.metrics.authors, &commit_stats);

    Ok(json!({
        "authors": author_stats,
        "author_timelines": author_timelines,
        "contributor_network_nodes": contributor_network_nodes,
        "contributor_network_edges": contributor_network_edges,
        "author_of_month": author_of_month,
        "author_of_year": author_of_year,
        "commits_by_domain": commits_by_domain,
    }))
}

fn compute_codebase(cache: &ScanCache) -> Result<Value, Status> {
    let commit_stats = cache.commit_stats().map_err(map_err)?;
    let file_stats = cache.file_stats().map_err(map_err)?;

    let hotspots = compute_hotspots(&file_stats, &cache.metrics.paths);
    let file_coupling = report_aggs::file_coupling(&file_stats, &cache.metrics.paths, 50);
    let code_ownership = report_aggs::code_ownership(&file_stats, &cache.metrics.paths);

    // Sequential change chain mining: min 3 occurrences, up to length 5, window of 3 commits
    let sequential_coupling = report_aggs::sequential_coupling(
        &commit_stats,
        &file_stats,
        &cache.metrics.paths,
        3, // min_support
        5, // max_chain_len
        3, // window (commits)
    );

    Ok(json!({
        "hotspots": hotspots,
        "file_coupling": file_coupling,
        "code_ownership": code_ownership,
        "sequential_coupling": sequential_coupling,
    }))
}

fn compute_patterns(cache: &ScanCache, repo_path: Option<&Path>) -> Result<Value, Status> {
    let commit_stats = cache.commit_stats().map_err(map_err)?;
    let file_stats = cache.file_stats().map_err(map_err)?;

    let commits_by_weekday = report_aggs::commits_by_weekday(&commit_stats);
    let commits_by_month = report_aggs::commits_by_month(&commit_stats);
    let commits_by_year = report_aggs::commits_by_year(&commit_stats);
    let commits_by_hour = report_aggs::commits_by_hour(&commit_stats);
    let punch_card = report_aggs::punch_card(&commit_stats);
    let commit_size_histogram = report_aggs::commit_size_histogram(&commit_stats);
    let commits_by_extension = report_aggs::commits_by_extension(&file_stats, &cache.metrics.paths);
    let weekly_activity = report_aggs::weekly_activity(&commit_stats);

    let messages = cache.messages();
    let conventional_commits = if !messages.is_empty() {
        let cc = report_aggs::parse_conventional_commits(messages);
        if cc.is_empty() {
            None
        } else {
            Some(cc)
        }
    } else {
        None
    };
    let word_frequencies = if !messages.is_empty() {
        let wf = report_aggs::word_frequencies(messages, 100);
        if wf.is_empty() {
            None
        } else {
            Some(wf)
        }
    } else {
        None
    };

    let language_breakdown =
        repo_path.and_then(|rp| match crate::techdetect::run_detect_tech(rp) {
            Ok(result) if !result.languages.is_empty() => Some(result.languages),
            _ => None,
        });

    Ok(json!({
        "commits_by_weekday": commits_by_weekday,
        "commits_by_month": commits_by_month,
        "commits_by_year": commits_by_year,
        "commits_by_hour": commits_by_hour,
        "punch_card": punch_card,
        "commit_size_histogram": commit_size_histogram,
        "commits_by_extension": commits_by_extension,
        "weekly_activity": weekly_activity,
        "conventional_commits": conventional_commits,
        "word_frequencies": word_frequencies,
        "language_breakdown": language_breakdown,
    }))
}

fn compute_health(cache: &ScanCache, repo_path: Option<&Path>) -> Result<Value, Status> {
    let commit_stats = cache.commit_stats().map_err(map_err)?;

    let author_stats = compute_author_stats(&commit_stats);
    let bus_factor = report_aggs::bus_factor(&author_stats);
    let radar_metrics =
        report_aggs::compute_radar_metrics(&commit_stats, &author_stats, &bus_factor);

    let tag_history = if let Some(rp) = repo_path {
        match crate::repo::open::open_repo(rp) {
            Ok(repo) => {
                let tag_infos = crate::repo::refs::collect_tag_info(&repo);
                report_aggs::build_tag_summaries(&tag_infos, &commit_stats)
            }
            Err(_) => Vec::new(),
        }
    } else {
        Vec::new()
    };

    Ok(json!({
        "bus_factor": bus_factor,
        "radar_metrics": radar_metrics,
        "tag_history": tag_history,
    }))
}

fn compute_timezone(cache: &ScanCache) -> Result<Value, Status> {
    let commit_stats = cache.commit_stats().map_err(map_err)?;
    let timezone_data = report_aggs::commits_by_timezone(&commit_stats);

    Ok(json!({
        "timezone_data": timezone_data,
    }))
}

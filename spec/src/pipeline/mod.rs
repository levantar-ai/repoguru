pub mod aggregator;
pub mod planner;
pub mod worker;

use std::sync::Arc;

use crate::cli::ScanArgs;
use crate::error::ScanError;
use crate::pipeline::worker::WorkerConfig;
use crate::progress::ScanProgress;
use crate::repo::open::open_repo;
use crate::repo::refs::collect_tips;
use crate::telemetry::{PerfTelemetry, ScanLog, Timer};
use crate::walk::revwalk::deterministic_walk;
use crate::walk::workitem::expand_to_workitems;

/// Run the full scan pipeline.
pub fn run_pipeline(args: &ScanArgs) -> Result<(), ScanError> {
    let total_timer = Timer::start();
    let mut telemetry = PerfTelemetry::new();

    // Create output directories early so we can start logging
    let out = &args.out;
    std::fs::create_dir_all(out.join("tables"))
        .map_err(|e| ScanError::ScanFailed(format!("failed to create output dir: {e}")))?;

    let log = Arc::new(
        ScanLog::new(out, args.verbose)
            .map_err(|e| ScanError::ScanFailed(format!("failed to create scan.log: {e}")))?,
    );

    // Multi-level progress bars
    let progress = Arc::new(ScanProgress::new());
    let (multi, status) = progress.multi_and_status();
    log.set_multi_progress(multi, status);

    progress.enter_phase("opening repo");
    log.log(&format!(
        "[open] Opening repository: {}",
        args.repo.display()
    ));
    let repo = open_repo(&args.repo)?;
    let tips = collect_tips(&repo, args.include_remotes.is_on())?;
    log.log(&format!("[open] Found {} tip refs", tips.len()));
    progress.finish_phase();

    // Phase: deterministic walk
    progress.enter_phase("walking history");
    let walk_timer = Timer::start();
    let commits = deterministic_walk(&repo, &tips)?;
    let items = expand_to_workitems(&commits, &repo, args.merge_policy)?;
    telemetry.walk_time_ms = walk_timer.elapsed_ms();
    log.log(&format!(
        "[walk] {} commits, {} work items ({}ms)",
        commits.len(),
        items.len(),
        telemetry.walk_time_ms
    ));
    progress.finish_phase();

    // Phase: diff + write
    progress.enter_phase("diffing commits");
    progress.init_diff(items.len() as u64);
    let diff_counter = progress.diff_counter();
    let diff_timer = Timer::start();
    let (work_tx, work_rx) = crossbeam_channel::bounded(args.channel_capacity);
    let (result_tx, result_rx) = crossbeam_channel::bounded(args.channel_capacity);

    let repo_path = args.repo.clone();
    let renames_enabled = args.renames.is_on();
    let copies_enabled = args.copies.is_on();
    let rename_threshold = args.rename_threshold as u16;

    let worker_config = WorkerConfig {
        renames_enabled,
        copies_enabled,
        rename_threshold,
        max_diff_files: args.max_diff_files,
        merge_diff_limit: args.merge_diff_limit,
        worker_cache_bytes: args.worker_cache_mb * 1024 * 1024,
    };

    // Determine number of worker threads
    let num_workers = args
        .threads
        .unwrap_or_else(|| {
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(4)
        })
        .max(1);
    log.log(&format!("[diff] Spawning {} worker threads", num_workers));

    // Planner thread
    let planner_handle = std::thread::spawn(move || {
        planner::run_planner(items, work_tx);
    });

    // Worker threads — each opens its own repo handle
    let mut worker_handles = Vec::with_capacity(num_workers);
    for _ in 0..num_workers {
        let rx = work_rx.clone();
        let tx = result_tx.clone();
        let path = repo_path.clone();
        let cfg = worker_config.clone();
        worker_handles.push(std::thread::spawn(move || {
            worker::run_worker(&path, rx, tx, &cfg);
        }));
    }
    // Drop our copies so aggregator sees channel close when all workers finish
    drop(work_rx);
    drop(result_tx);

    // Aggregator (runs on main thread)
    let agg_log = Arc::clone(&log);
    let agg_progress = Arc::clone(&progress);
    let agg_result = aggregator::run_aggregator(result_rx, out, renames_enabled, &agg_log, &diff_counter, &agg_progress);

    planner_handle.join().expect("planner thread panicked");
    for handle in worker_handles {
        handle.join().expect("worker thread panicked");
    }

    let (mut metrics, commit_count, file_change_count) = agg_result?;
    progress.finish_diff();
    telemetry.diff_time_ms = diff_timer.elapsed_ms();
    telemetry.commits_processed = commit_count;
    telemetry.file_changes_processed = file_change_count;
    log.log(&format!(
        "[diff] {} commits, {} file changes processed ({}ms)",
        commit_count, file_change_count, telemetry.diff_time_ms
    ));
    progress.finish_phase();

    // Compute repo-level sizer metrics
    progress.enter_phase("sizing objects");
    log.log("[sizer] Scanning object database...");
    let (ref_count, branch_count, tag_ref_count) = crate::repo::refs::count_refs(&repo);
    let repo_metrics = crate::metrics::sizer::compute_repo_metrics(
        &repo,
        &tips,
        args.max_top,
        &log,
        ref_count,
        branch_count,
        tag_ref_count,
        args.sizer_chunk_size,
        args.sizer_cache_mb * 1024 * 1024,
        &progress,
    )?;
    metrics.repo_metrics = Some(repo_metrics);
    progress.finish_sizer();
    progress.finish_phase();

    // Optional GitHub enrichment (auto-detect or explicit)
    let github_data = if args.github.should_try() {
        match crate::github::remote::parse_github_remote(&repo) {
            Some((owner, name)) => {
                progress.enter_phase("github enrichment");
                log.log(&format!("[github] Detected GitHub repo: {}/{}", owner, name));
                let result = match crate::github::enrich(&owner, &name, args.github_token.as_deref(), Some(&args.github_api_url)) {
                    Ok(data) => {
                        log.log("[github] Enrichment complete");
                        Some(data)
                    }
                    Err(e) => {
                        log.log(&format!("[github] Warning: {}", e));
                        None
                    }
                };
                progress.finish_phase();
                result
            }
            None => {
                if args.github == crate::cli::GitHubMode::On {
                    log.log("[github] Warning: --github=on but no GitHub remote detected");
                }
                None
            }
        }
    } else {
        None
    };

    // Write github.json if data is present
    if let Some(ref gh) = github_data {
        let gh_json = serde_json::to_string_pretty(gh)
            .map_err(|e| ScanError::ScanFailed(format!("serialize github.json: {e}")))?;
        std::fs::write(out.join("github.json"), gh_json)
            .map_err(|e| ScanError::ScanFailed(format!("write github.json: {e}")))?;
    }

    // Write metrics.json
    progress.enter_phase("writing output");
    let write_timer = Timer::start();
    crate::writer::json_writer::write_metrics_json(&out.join("metrics.json"), &metrics)
        .map_err(|e| ScanError::ScanFailed(format!("failed to write metrics.json: {e}")))?;
    telemetry.write_time_ms = write_timer.elapsed_ms();

    // Generate report if enabled
    if args.report.is_on() {
        log.log("[report] Generating HTML report...");
        generate_report(out, &metrics, &args.repo, github_data.as_ref())
            .map_err(|e| ScanError::ReportFailed(format!("report generation failed: {e}")))?;
    }
    progress.finish_phase();

    // Write telemetry
    telemetry.total_time_ms = total_timer.elapsed_ms();
    if args.telemetry.is_on() {
        telemetry
            .write_to(&out.join("perf.json"))
            .map_err(|e| ScanError::ScanFailed(format!("failed to write perf.json: {e}")))?;
    }

    let report_path = out.join("report/index.html");
    let summary = format!(
        "[done] Scan complete in {:.1}s ({} commits, {} file changes)\n  Report: {}",
        telemetry.total_time_ms as f64 / 1000.0,
        commit_count,
        file_change_count,
        report_path.display()
    );
    log.log(&summary);
    progress.finish_all(&summary);

    Ok(())
}

/// Read back binary tables and generate the HTML report.
fn generate_report(
    out: &std::path::Path,
    metrics: &crate::writer::json_writer::Metrics,
    repo_path: &std::path::Path,
    github: Option<&crate::github::GitHubEnrichment>,
) -> Result<(), ScanError> {
    use crate::aggregate::author::compute_author_stats;
    use crate::aggregate::hotspot::compute_hotspots;
    use crate::aggregate::report_aggs;
    use crate::aggregate::timeseries::{compute_timeseries, Granularity};
    use crate::model::loader;

    let commit_stats = loader::load_commit_stats(out)?;
    let file_stats = loader::load_file_stats(out)?;

    // Existing aggregations
    let timeseries = compute_timeseries(&commit_stats, Granularity::Daily);
    let author_stats = compute_author_stats(&commit_stats);
    let hotspots = compute_hotspots(&file_stats, &metrics.paths);

    // Phase 2 aggregations
    let commits_by_weekday = report_aggs::commits_by_weekday(&commit_stats);
    let commits_by_month = report_aggs::commits_by_month(&commit_stats);
    let commits_by_year = report_aggs::commits_by_year(&commit_stats);
    let punch_card = report_aggs::punch_card(&commit_stats);
    let commit_size_histogram = report_aggs::commit_size_histogram(&commit_stats);
    let bus_factor = report_aggs::bus_factor(&author_stats);
    let commits_by_extension = report_aggs::commits_by_extension(&file_stats, &metrics.paths);

    // Phase 3: read commit message subjects if available
    let messages_path = out.join("tables/messages.txt");
    let (conventional_commits, word_frequencies) = if messages_path.exists() {
        let content = std::fs::read_to_string(&messages_path).unwrap_or_default();
        let subjects: Vec<String> = content.lines().map(|l| l.to_string()).collect();
        let cc = report_aggs::parse_conventional_commits(&subjects);
        let wf = report_aggs::word_frequencies(&subjects, 100);
        (
            if cc.is_empty() { None } else { Some(cc) },
            if wf.is_empty() { None } else { Some(wf) },
        )
    } else {
        (None, None)
    };

    // Phase 3: detect-tech language breakdown
    let language_breakdown = match crate::techdetect::run_detect_tech(repo_path) {
        Ok(result) if !result.languages.is_empty() => Some(result.languages),
        _ => None,
    };

    // Phase 3: file coupling
    let file_coupling = report_aggs::file_coupling(&file_stats, &metrics.paths, 50);

    // Radar metrics
    let radar_metrics =
        report_aggs::compute_radar_metrics(&commit_stats, &author_stats, &bus_factor);

    // Phase 5 aggregations
    let commits_by_hour = report_aggs::commits_by_hour(&commit_stats);
    let commits_by_domain = report_aggs::commits_by_domain(&metrics.authors, &commit_stats);
    let author_of_month = report_aggs::author_of_month(&commit_stats);
    let author_of_year = report_aggs::author_of_year(&commit_stats);
    let weekly_activity = report_aggs::weekly_activity(&commit_stats);

    // Tag history
    let tag_infos = crate::repo::refs::collect_tag_info(
        &crate::repo::open::open_repo(repo_path)?,
    );
    let tag_history = report_aggs::build_tag_summaries(&tag_infos, &commit_stats);

    // Phase 6 aggregations
    let cumulative_files =
        report_aggs::cumulative_files_over_time(&commit_stats, &file_stats);
    let file_operations = report_aggs::file_operations_breakdown(&file_stats);
    let lines_by_ext = report_aggs::lines_by_extension(&file_stats, &metrics.paths);
    let lines_stats_summary = report_aggs::lines_stats_summary(&commit_stats);
    let author_timelines = report_aggs::author_timelines(&commit_stats, 10);
    let (network_nodes_raw, contributor_network_edges) =
        report_aggs::contributor_network(&file_stats, 3, 20);
    let contributor_network_nodes: Vec<(u32, String)> = network_nodes_raw
        .iter()
        .map(|id| (*id, metrics.authors.get(id).cloned().unwrap_or_default()))
        .collect();
    let code_ownership = report_aggs::code_ownership(&file_stats, &metrics.paths);
    let timezone_data = report_aggs::commits_by_timezone(&commit_stats);
    let lines_by_ext_time =
        report_aggs::lines_by_extension_over_time(&commit_stats, &file_stats, &metrics.paths, 10);

    // Sequential change chain mining
    let sequential_coupling = report_aggs::sequential_coupling(
        &commit_stats,
        &file_stats,
        &metrics.paths,
        3,  // min_support
        5,  // max_chain_len
        3,  // window (commits)
    );

    // Emit JSON data files for programmatic access
    crate::report::data_json::emit_summary(out, metrics)
        .map_err(|e| ScanError::ReportFailed(format!("emit summary: {e}")))?;
    crate::report::data_json::emit_timelines(out, &timeseries)
        .map_err(|e| ScanError::ReportFailed(format!("emit timelines: {e}")))?;
    crate::report::data_json::emit_authors(out, &author_stats)
        .map_err(|e| ScanError::ReportFailed(format!("emit authors: {e}")))?;
    crate::report::data_json::emit_hotspots(out, &hotspots)
        .map_err(|e| ScanError::ReportFailed(format!("emit hotspots: {e}")))?;

    // Generate self-contained HTML with embedded data
    let report_data = crate::report::html::ReportData {
        metrics,
        timeseries: &timeseries,
        authors: &author_stats,
        hotspots: &hotspots,
        commits_by_weekday,
        commits_by_month,
        commits_by_year,
        punch_card,
        commit_size_histogram,
        bus_factor,
        commits_by_extension,
        conventional_commits,
        word_frequencies,
        language_breakdown,
        file_coupling,
        radar_metrics,
        commits_by_hour,
        commits_by_domain,
        author_of_month,
        author_of_year,
        weekly_activity,
        tag_history,
        cumulative_files,
        file_operations,
        lines_by_ext,
        lines_stats_summary,
        author_timelines,
        contributor_network_nodes,
        contributor_network_edges,
        code_ownership,
        timezone_data,
        lines_by_ext_time,
        sequential_coupling,
        github: github.cloned(),
    };
    crate::report::html::generate_index_html(out, &report_data)
        .map_err(|e| ScanError::ReportFailed(format!("generate index.html: {e}")))?;

    Ok(())
}

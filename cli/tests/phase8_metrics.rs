mod common;

use repoanalyze::metrics::sizer::{compute_repo_metrics, ObjectType};
use repoanalyze::repo::open::open_repo;
use repoanalyze::repo::refs::collect_tips;
use repoanalyze::telemetry::ScanLog;
use std::sync::Arc;

fn test_log() -> Arc<ScanLog> {
    let tmp = tempfile::tempdir().unwrap();
    Arc::new(ScanLog::new(tmp.path()).unwrap())
}

#[test]
fn phase8_test_object_counts() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let log = test_log();

    let metrics =
        compute_repo_metrics(&repo, &tips, 10, &log, 0, 0, 0, 10_000, 64 * 1024 * 1024).unwrap();

    // Simple repo: 3 commits
    assert_eq!(
        *metrics.object_counts.get(&ObjectType::Commit).unwrap_or(&0),
        3
    );
    // At least 3 trees (one per commit)
    assert!(*metrics.object_counts.get(&ObjectType::Tree).unwrap_or(&0) >= 3);
    // At least 3 blobs (hello v1, hello v2, world)
    assert!(*metrics.object_counts.get(&ObjectType::Blob).unwrap_or(&0) >= 3);
}

#[test]
fn phase8_test_largest_blob() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let log = test_log();

    let metrics =
        compute_repo_metrics(&repo, &tips, 10, &log, 0, 0, 0, 10_000, 64 * 1024 * 1024).unwrap();

    // Largest blob should be "Hello, modified world!\n" (23 bytes)
    assert!(!metrics.largest_blobs.is_empty());
    let (_, largest_size) = &metrics.largest_blobs[0];
    assert!(
        *largest_size >= 14,
        "largest blob should be at least 14 bytes"
    );
}

#[test]
fn phase8_test_merge_count() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo_path, _) = common::fixture::create_diamond_merge_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let log = test_log();

    let metrics =
        compute_repo_metrics(&repo, &tips, 10, &log, 0, 0, 0, 10_000, 64 * 1024 * 1024).unwrap();

    // Diamond repo has 1 merge commit (D)
    assert_eq!(metrics.merge_count, 1);
    assert_eq!(metrics.max_parents, 2);
}

#[test]
fn phase8_test_metrics_in_json() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();

    let out = tempfile::tempdir().unwrap();
    let args = repoanalyze::cli::ScanArgs {
        repo: repo_path,
        out: out.path().to_path_buf(),
        threads: None,
        merge_policy: repoanalyze::cli::MergePolicy::FirstParent,
        renames: repoanalyze::cli::OnOff::Off,
        copies: repoanalyze::cli::OnOff::Off,
        rename_threshold: 50,
        include_remotes: repoanalyze::cli::OnOff::Off,
        max_top: 50,
        format: repoanalyze::cli::OutputFormat::Raw,
        report: repoanalyze::cli::OnOff::Off,
        telemetry: repoanalyze::cli::OnOff::Off,
        since: None,
        until: None,
        max_diff_files: 1000,
        merge_diff_limit: 100,
        worker_cache_mb: 128,
        sizer_cache_mb: 64,
        sizer_chunk_size: 10_000,
        channel_capacity: 256,
    };

    repoanalyze::pipeline::run_pipeline(&args).unwrap();

    let json_str = std::fs::read_to_string(out.path().join("metrics.json")).unwrap();
    let val: serde_json::Value = serde_json::from_str(&json_str).unwrap();
    let obj = val.as_object().unwrap();

    // Sizer metrics should be present
    assert!(
        obj.contains_key("repo_metrics"),
        "metrics.json should contain repo_metrics"
    );
    let rm = obj["repo_metrics"].as_object().unwrap();
    assert!(rm.contains_key("object_counts"));
    assert!(rm.contains_key("total_bytes"));
    assert!(rm.contains_key("largest_blobs"));
    assert!(rm.contains_key("largest_trees"));
    assert!(rm.contains_key("deepest_path"));
    assert!(rm.contains_key("longest_name"));
    assert!(rm.contains_key("max_parents"));
    assert!(rm.contains_key("merge_count"));
    assert!(rm.contains_key("oldest_commit"));
    assert!(rm.contains_key("newest_commit"));
}

#[test]
fn phase8_test_max_top_limit() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let log = test_log();

    // Limit top-N to 2
    let metrics =
        compute_repo_metrics(&repo, &tips, 2, &log, 0, 0, 0, 10_000, 64 * 1024 * 1024).unwrap();

    assert!(
        metrics.largest_blobs.len() <= 2,
        "largest_blobs should be limited to max_top"
    );
    assert!(
        metrics.largest_trees.len() <= 2,
        "largest_trees should be limited to max_top"
    );
}

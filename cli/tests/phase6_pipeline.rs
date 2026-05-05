mod common;

use std::path::Path;

use repoanalyze::model::commit_stat::{CommitStat, COMMIT_STAT_ROW_SIZE};
use repoanalyze::model::file_stat::{FileStat, FILE_STAT_ROW_SIZE};

/// Run the full pipeline on a fixture repo, return the output directory path.
fn run_pipeline_on(repo_path: &Path) -> tempfile::TempDir {
    let out_dir = tempfile::tempdir().expect("create tempdir");

    let args = repoanalyze::cli::ScanArgs {
        repo: repo_path.to_path_buf(),
        out: out_dir.path().to_path_buf(),
        threads: None,
        merge_policy: repoanalyze::cli::MergePolicy::FirstParent,
        renames: repoanalyze::cli::OnOff::Off,
        copies: repoanalyze::cli::OnOff::Off,
        rename_threshold: 50,
        include_remotes: repoanalyze::cli::OnOff::Off,
        max_top: 50,
        format: repoanalyze::cli::OutputFormat::Raw,
        report: repoanalyze::cli::OnOff::Off,
        telemetry: repoanalyze::cli::OnOff::On,
        since: None,
        until: None,
        max_diff_files: 1000,
        merge_diff_limit: 100,
        worker_cache_mb: 128,
        sizer_cache_mb: 64,
        sizer_chunk_size: 10_000,
        channel_capacity: 256,
        max_commits: 0,
    };

    repoanalyze::pipeline::run_pipeline(&args).expect("pipeline should succeed");
    out_dir
}

/// Phase 6: end-to-end scan produces expected output files.
#[test]
fn phase6_test_end_to_end_scan() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_on(&repo_path);

    assert!(out.path().join("tables/commit_stats.bin").exists());
    assert!(out.path().join("tables/file_stats.bin").exists());
    assert!(out.path().join("metrics.json").exists());
    assert!(out.path().join("perf.json").exists());
}

/// Phase 6: commit_stats.bin has the correct number of rows.
/// Simple repo has 3 commits, first-parent yields 3 WorkItems.
#[test]
fn phase6_test_commit_stats_row_count() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_on(&repo_path);

    let data = std::fs::read(out.path().join("tables/commit_stats.bin")).unwrap();
    assert_eq!(
        data.len() % COMMIT_STAT_ROW_SIZE,
        0,
        "file size must be multiple of row size"
    );
    let row_count = data.len() / COMMIT_STAT_ROW_SIZE;
    assert_eq!(row_count, 3, "3 commits = 3 rows");
}

/// Phase 6: file_stats.bin has the correct number of rows.
/// Simple repo changes:
///   Commit 1 (root): +hello.txt = 1 file change
///   Commit 2: modify hello.txt, add world.txt = 2 file changes
///   Commit 3: delete world.txt = 1 file change
///   Total: 4 file changes
#[test]
fn phase6_test_file_stats_row_count() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_on(&repo_path);

    let data = std::fs::read(out.path().join("tables/file_stats.bin")).unwrap();
    assert_eq!(
        data.len() % FILE_STAT_ROW_SIZE,
        0,
        "file size must be multiple of row size"
    );
    let row_count = data.len() / FILE_STAT_ROW_SIZE;
    assert_eq!(row_count, 4, "4 file changes total");
}

/// Phase 6: binary roundtrip — write + read back CommitStat rows, verify fields.
#[test]
fn phase6_test_binary_roundtrip() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_on(&repo_path);

    let data = std::fs::read(out.path().join("tables/commit_stats.bin")).unwrap();
    let row_count = data.len() / COMMIT_STAT_ROW_SIZE;

    for i in 0..row_count {
        let start = i * COMMIT_STAT_ROW_SIZE;
        let row_data: &[u8; COMMIT_STAT_ROW_SIZE] = data[start..start + COMMIT_STAT_ROW_SIZE]
            .try_into()
            .unwrap();
        let cs = CommitStat::from_bytes(row_data);

        // Verify basic invariants
        assert!(cs.author_ts > 0, "author_ts should be positive");
        assert!(cs.commit_ts > 0, "commit_ts should be positive");
        assert!(cs.message_len > 0, "message should have length");

        // Re-serialize and verify roundtrip
        let rebytes = cs.to_bytes();
        assert_eq!(&rebytes[..], &data[start..start + COMMIT_STAT_ROW_SIZE]);
    }

    // Similarly for file_stats
    let fdata = std::fs::read(out.path().join("tables/file_stats.bin")).unwrap();
    let frow_count = fdata.len() / FILE_STAT_ROW_SIZE;

    for i in 0..frow_count {
        let start = i * FILE_STAT_ROW_SIZE;
        let row_data: &[u8; FILE_STAT_ROW_SIZE] =
            fdata[start..start + FILE_STAT_ROW_SIZE].try_into().unwrap();
        let fs = FileStat::from_bytes(row_data);
        let rebytes = fs.to_bytes();
        assert_eq!(&rebytes[..], &fdata[start..start + FILE_STAT_ROW_SIZE]);
    }
}

/// Phase 6: metrics.json is valid JSON with expected keys.
#[test]
fn phase6_test_metrics_json_valid() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_on(&repo_path);

    let json_str = std::fs::read_to_string(out.path().join("metrics.json")).unwrap();
    let val: serde_json::Value = serde_json::from_str(&json_str).expect("valid JSON");

    let obj = val.as_object().expect("top-level object");
    assert!(obj.contains_key("total_commits"));
    assert!(obj.contains_key("total_files_changed"));
    assert!(obj.contains_key("total_insertions"));
    assert!(obj.contains_key("total_deletions"));
    assert!(obj.contains_key("total_authors"));
    assert!(obj.contains_key("total_paths"));
    assert!(obj.contains_key("authors"));
    assert!(obj.contains_key("paths"));

    assert_eq!(obj["total_commits"].as_u64().unwrap(), 3);
    assert_eq!(obj["total_files_changed"].as_u64().unwrap(), 4);
    assert!(obj["total_authors"].as_u64().unwrap() >= 1);
    assert!(obj["total_paths"].as_u64().unwrap() >= 1);
}

/// Phase 6: aggregator handles out-of-order results correctly.
/// We directly test the aggregator with synthetic DiffResult values sent out of order.
#[test]
fn phase6_test_aggregator_seq_ordering() {
    use repoanalyze::model::change::{ChangeKind, RawChange};
    use repoanalyze::pipeline::aggregator::run_aggregator;
    use repoanalyze::pipeline::worker::{DiffResult, FileChange};

    let out_dir = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(out_dir.path().join("tables")).unwrap();

    let (tx, rx) = crossbeam_channel::bounded(16);

    let zero = gix::ObjectId::null(gix::hash::Kind::Sha1);

    // Send results OUT OF ORDER: seq 2, seq 0, seq 1
    for seq in [2u64, 0, 1] {
        let dr = DiffResult {
            seq,
            commit_oid: zero,
            parent_oid: zero,
            tree_oid: zero,
            parent_tree_oid: zero,
            author_key: format!("author{seq}@example.com"),
            committer_key: format!("author{seq}@example.com"),
            author_ts: 1_700_000_000 + seq as i64,
            commit_ts: 1_700_000_000 + seq as i64,
            message_len: 10,
            parents_count: if seq == 0 { 0 } else { 1 },
            is_merge: false,
            changes: vec![FileChange {
                raw: RawChange {
                    path: format!("file{seq}.txt"),
                    old_oid: zero,
                    new_oid: zero,
                    old_mode: 0o100644,
                    new_mode: 0o100644,
                    kind: ChangeKind::Add,
                },
                is_binary: false,
                insertions: 1,
                deletions: 0,
                diff_bailed_out: false,
            }],
            rename_pairs: vec![],
            copy_pairs: vec![],
            diff_time_ns: 100,
            tree_truncated: false,
            message_subject: format!("commit {seq}"),
        };
        tx.send(dr).unwrap();
    }
    drop(tx);

    let log = std::sync::Arc::new(repoanalyze::telemetry::ScanLog::new(out_dir.path()).unwrap());
    let (metrics, commit_count, file_change_count) =
        run_aggregator(rx, out_dir.path(), false, &log).expect("aggregator should succeed");

    assert_eq!(commit_count, 3);
    assert_eq!(file_change_count, 3);
    assert_eq!(metrics.total_commits, 3);

    // Verify rows written in order by reading commit_stats.bin
    let data = std::fs::read(out_dir.path().join("tables/commit_stats.bin")).unwrap();
    assert_eq!(data.len(), 3 * COMMIT_STAT_ROW_SIZE);

    // Rows should be in seq order (0, 1, 2) — verify via author_ts
    for i in 0..3u64 {
        let start = (i as usize) * COMMIT_STAT_ROW_SIZE;
        let row: &[u8; COMMIT_STAT_ROW_SIZE] = data[start..start + COMMIT_STAT_ROW_SIZE]
            .try_into()
            .unwrap();
        let cs = CommitStat::from_bytes(row);
        assert_eq!(
            cs.author_ts,
            1_700_000_000 + i as i64,
            "row {i} should be seq {i}"
        );
    }
}

/// Phase 6: same author gets same ID across runs (deterministic).
#[test]
fn phase6_test_author_id_determinism() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();

    // Run twice, compare metrics
    let out1 = run_pipeline_on(&repo_path);
    let out2 = run_pipeline_on(&repo_path);

    let json1 = std::fs::read_to_string(out1.path().join("metrics.json")).unwrap();
    let json2 = std::fs::read_to_string(out2.path().join("metrics.json")).unwrap();

    let val1: serde_json::Value = serde_json::from_str(&json1).unwrap();
    let val2: serde_json::Value = serde_json::from_str(&json2).unwrap();

    // Author dictionaries should be identical
    assert_eq!(val1["authors"], val2["authors"]);
    // Path dictionaries should be identical
    assert_eq!(val1["paths"], val2["paths"]);
    // All metrics should be identical
    assert_eq!(val1, val2);

    // Verify binary output is identical except for diff_time_ns (which varies).
    // diff_time_ns is at offset 144 (8 bytes) in the 160-byte CommitStat row.
    let bin1 = std::fs::read(out1.path().join("tables/commit_stats.bin")).unwrap();
    let bin2 = std::fs::read(out2.path().join("tables/commit_stats.bin")).unwrap();
    assert_eq!(
        bin1.len(),
        bin2.len(),
        "commit_stats.bin should be same size"
    );
    let row_count = bin1.len() / COMMIT_STAT_ROW_SIZE;
    for i in 0..row_count {
        let base = i * COMMIT_STAT_ROW_SIZE;
        // Compare everything except diff_time_ns (offset 142, 8 bytes)
        assert_eq!(
            &bin1[base..base + 142],
            &bin2[base..base + 142],
            "row {i} prefix should match"
        );
        assert_eq!(
            &bin1[base + 150..base + COMMIT_STAT_ROW_SIZE],
            &bin2[base + 150..base + COMMIT_STAT_ROW_SIZE],
            "row {i} suffix should match"
        );
    }

    let fbin1 = std::fs::read(out1.path().join("tables/file_stats.bin")).unwrap();
    let fbin2 = std::fs::read(out2.path().join("tables/file_stats.bin")).unwrap();
    assert_eq!(
        fbin1, fbin2,
        "file_stats.bin should be byte-identical across runs"
    );
}

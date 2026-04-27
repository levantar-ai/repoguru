mod common;

use gix::ObjectId;
use std::collections::BTreeMap;

use repoanalyze::aggregate::author::compute_author_stats;
use repoanalyze::aggregate::hotspot::compute_hotspots;
use repoanalyze::aggregate::lifecycle::compute_file_entities;
use repoanalyze::aggregate::timeseries::{compute_timeseries, Granularity};
use repoanalyze::model::commit_stat::CommitStat;
use repoanalyze::model::file_stat::FileStat;
use repoanalyze::model::rename_event::RenameEvent;

fn zero_oid() -> ObjectId {
    ObjectId::null(gix::hash::Kind::Sha1)
}

fn make_commit_stat(author_id: u32, ts: i64, insertions: u64, deletions: u64) -> CommitStat {
    CommitStat {
        commit_oid: zero_oid(),
        parent_oid: zero_oid(),
        tree_oid: zero_oid(),
        parent_tree_oid: zero_oid(),
        author_id,
        committer_id: author_id,
        author_ts: ts,
        commit_ts: ts,
        message_len: 10,
        parents_count: 1,
        is_merge: 0,
        files_changed: 1,
        insertions,
        deletions,
        binary_files_changed: 0,
        renames: 0,
        copies: 0,
        diff_time_ns: 0,
        diff_bytes_inflated: 0,
    }
}

fn make_file_stat(path_id: u32, author_id: u32, insertions: u32, deletions: u32) -> FileStat {
    FileStat {
        commit_oid: zero_oid(),
        parent_oid: zero_oid(),
        author_id,
        path_id,
        change_kind: 2, // Modify
        old_path_id: path_id,
        old_blob_oid: zero_oid(),
        new_blob_oid: zero_oid(),
        old_mode: 0o100644,
        new_mode: 0o100644,
        is_binary: 0,
        insertions,
        deletions,
    }
}

#[test]
fn phase9_test_daily_timeseries() {
    // Two commits on different days
    let stats = vec![
        make_commit_stat(0, 1_700_000_000, 10, 5), // 2023-11-14
        make_commit_stat(0, 1_700_086_400, 20, 3), // 2023-11-15
        make_commit_stat(1, 1_700_086_400, 5, 2),  // 2023-11-15 (different author)
    ];

    let ts = compute_timeseries(&stats, Granularity::Daily);

    assert_eq!(ts.len(), 2, "should have 2 daily buckets");
    // First bucket (2023-11-14)
    assert_eq!(ts[0].commits, 1);
    assert_eq!(ts[0].insertions, 10);
    assert_eq!(ts[0].deletions, 5);
    assert_eq!(ts[0].authors, 1);

    // Second bucket (2023-11-15)
    assert_eq!(ts[1].commits, 2);
    assert_eq!(ts[1].insertions, 25);
    assert_eq!(ts[1].deletions, 5);
    assert_eq!(ts[1].authors, 2); // Two distinct authors
}

#[test]
fn phase9_test_weekly_timeseries() {
    // Commits spread across two weeks
    // 2023-11-14 is a Tuesday, 2023-11-20 is Monday (next week)
    let stats = vec![
        make_commit_stat(0, 1_700_000_000, 10, 5), // 2023-11-14 Tue
        make_commit_stat(0, 1_700_518_400, 20, 3), // 2023-11-20 Mon (6 days later)
    ];

    let ts = compute_timeseries(&stats, Granularity::Weekly);

    assert_eq!(ts.len(), 2, "should have 2 weekly buckets");
    assert_eq!(ts[0].commits, 1);
    assert_eq!(ts[1].commits, 1);
}

#[test]
fn phase9_test_hotspot_ranking() {
    let paths: BTreeMap<u32, String> = [(0, "quiet.txt".to_string()), (1, "hot.txt".to_string())]
        .into_iter()
        .collect();

    let file_stats = vec![
        make_file_stat(0, 0, 1, 0),   // quiet: 1 churn
        make_file_stat(1, 0, 10, 5),  // hot: 15 churn
        make_file_stat(1, 1, 20, 10), // hot: 30 more churn
    ];

    let hotspots = compute_hotspots(&file_stats, &paths);

    assert_eq!(hotspots.len(), 2);
    assert_eq!(hotspots[0].path, "hot.txt", "hottest file should be first");
    assert_eq!(hotspots[0].total_churn, 45);
    assert_eq!(hotspots[0].commits, 2);
    assert_eq!(hotspots[1].path, "quiet.txt");
    assert_eq!(hotspots[1].total_churn, 1);
}

#[test]
fn phase9_test_distinct_authors_per_file() {
    let paths: BTreeMap<u32, String> = [(0, "file.txt".to_string())].into_iter().collect();

    // Same file touched by 3 different authors (one author touches twice)
    let file_stats = vec![
        make_file_stat(0, 0, 1, 0),
        make_file_stat(0, 1, 2, 0),
        make_file_stat(0, 2, 3, 0),
        make_file_stat(0, 0, 4, 0), // author 0 again
    ];

    let hotspots = compute_hotspots(&file_stats, &paths);

    assert_eq!(hotspots.len(), 1);
    assert_eq!(
        hotspots[0].distinct_authors, 3,
        "should be 3 distinct authors"
    );
}

#[test]
fn phase9_test_author_summary() {
    let stats = vec![
        make_commit_stat(0, 1_700_000_000, 10, 5),
        make_commit_stat(0, 1_700_001_000, 20, 3),
        make_commit_stat(1, 1_700_002_000, 5, 2),
    ];

    let summaries = compute_author_stats(&stats);

    assert_eq!(summaries.len(), 2);
    // Author 0 has more commits, should be first
    assert_eq!(summaries[0].author_id, 0);
    assert_eq!(summaries[0].commits, 2);
    assert_eq!(summaries[0].insertions, 30);
    assert_eq!(summaries[0].deletions, 8);
    assert_eq!(summaries[0].first_commit, 1_700_000_000);
    assert_eq!(summaries[0].last_commit, 1_700_001_000);

    assert_eq!(summaries[1].author_id, 1);
    assert_eq!(summaries[1].commits, 1);
}

#[test]
fn phase9_test_lifecycle_through_rename() {
    let all_paths = vec![0, 1, 2]; // path_id 0=old.txt, 1=new.txt, 2=other.txt

    let renames = vec![RenameEvent {
        commit_oid: zero_oid(),
        parent_oid: zero_oid(),
        old_path_id: 0,
        new_path_id: 1,
        score: 100,
        is_copy: 0,
    }];

    let entities = compute_file_entities(&all_paths, &renames);

    // path 0 and path 1 should have the same entity (smaller root = 0)
    assert_eq!(
        entities[&0], entities[&1],
        "renamed paths should share entity"
    );
    // path 2 should be its own entity
    assert_ne!(
        entities[&0], entities[&2],
        "unrelated path should be different entity"
    );
    assert_eq!(entities[&2], 2);
}

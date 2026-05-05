mod common;

use repoanalyze::rename::similarity::{line_hashes, similarity_score};

// --- Similarity tests ---

#[test]
fn phase7_test_similarity_identical() {
    let data = b"line one\nline two\nline three\n";
    let hashes = line_hashes(data);
    let score = similarity_score(&hashes, &hashes);
    assert_eq!(score, 100);
}

#[test]
fn phase7_test_similarity_empty() {
    let score = similarity_score(&[], &[]);
    assert_eq!(score, 0);

    let hashes = line_hashes(b"some content\n");
    let score2 = similarity_score(&hashes, &[]);
    assert_eq!(score2, 0);

    let score3 = similarity_score(&[], &hashes);
    assert_eq!(score3, 0);
}

#[test]
fn phase7_test_similarity_partial() {
    // 4 lines total in old, 4 lines total in new, 2 lines in common
    // score = 100 * (2*2) / (4+4) = 100 * 4/8 = 50
    let old = b"aaa\nbbb\nccc\nddd\n";
    let new = b"aaa\nbbb\neee\nfff\n";
    let old_h = line_hashes(old);
    let new_h = line_hashes(new);
    let score = similarity_score(&old_h, &new_h);
    assert_eq!(score, 50);
}

// --- Rename detection tests ---

#[test]
fn phase7_test_rename_detected() {
    use repoanalyze::model::change::{ChangeKind, RawChange};
    use repoanalyze::rename::detect::detect_renames;

    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let repo = gix::open(&repo_path).unwrap();

    // Create blobs with identical content (renamed file)
    let content = b"Hello, world!\nThis is a test.\nLine three.\n";
    let blob = repo.write_blob(content).unwrap().detach();

    let del = RawChange {
        path: "old_name.txt".to_string(),
        old_oid: blob,
        new_oid: gix::ObjectId::null(gix::hash::Kind::Sha1),
        old_mode: 0o100644,
        new_mode: 0,
        kind: ChangeKind::Delete,
    };
    let add = RawChange {
        path: "new_name.txt".to_string(),
        old_oid: gix::ObjectId::null(gix::hash::Kind::Sha1),
        new_oid: blob,
        old_mode: 0,
        new_mode: 0o100644,
        kind: ChangeKind::Add,
    };

    let pairs = detect_renames(&[&del], &[&add], &repo, 50).unwrap();
    assert_eq!(pairs.len(), 1);
    assert_eq!(pairs[0].score, 100);
    assert_eq!(pairs[0].old_idx, 0);
    assert_eq!(pairs[0].new_idx, 0);
}

#[test]
fn phase7_test_copy_detected() {
    use repoanalyze::model::change::{ChangeKind, RawChange};
    use repoanalyze::rename::detect::detect_copies;

    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let repo = gix::open(&repo_path).unwrap();

    let content = b"Hello, world!\nThis is a test.\nLine three.\n";
    let blob = repo.write_blob(content).unwrap().detach();

    // The "old" file still exists (Modify), the "new" file was added
    let old_file = RawChange {
        path: "existing.txt".to_string(),
        old_oid: blob,
        new_oid: blob,
        old_mode: 0o100644,
        new_mode: 0o100644,
        kind: ChangeKind::Modify,
    };
    let new_file = RawChange {
        path: "copied.txt".to_string(),
        old_oid: gix::ObjectId::null(gix::hash::Kind::Sha1),
        new_oid: blob,
        old_mode: 0,
        new_mode: 0o100644,
        kind: ChangeKind::Add,
    };

    let copies = detect_copies(&[&new_file], &[&old_file], &repo, 50).unwrap();
    assert_eq!(copies.len(), 1);
    assert_eq!(copies[0].score, 100);
}

#[test]
fn phase7_test_rename_threshold() {
    use repoanalyze::model::change::{ChangeKind, RawChange};
    use repoanalyze::rename::detect::detect_renames;

    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let repo = gix::open(&repo_path).unwrap();

    // Old: 4 lines, New: 4 lines with only 1 in common
    // score = 100 * (2*1)/(4+4) = 25
    let old_content = b"aaa\nbbb\nccc\nddd\n";
    let new_content = b"aaa\neee\nfff\nggg\n";
    let old_blob = repo.write_blob(old_content).unwrap().detach();
    let new_blob = repo.write_blob(new_content).unwrap().detach();

    let del = RawChange {
        path: "old.txt".to_string(),
        old_oid: old_blob,
        new_oid: gix::ObjectId::null(gix::hash::Kind::Sha1),
        old_mode: 0o100644,
        new_mode: 0,
        kind: ChangeKind::Delete,
    };
    let add = RawChange {
        path: "new.txt".to_string(),
        old_oid: gix::ObjectId::null(gix::hash::Kind::Sha1),
        new_oid: new_blob,
        old_mode: 0,
        new_mode: 0o100644,
        kind: ChangeKind::Add,
    };

    // Threshold 50 — score 25 is below → no rename
    let pairs = detect_renames(&[&del], &[&add], &repo, 50).unwrap();
    assert_eq!(pairs.len(), 0);

    // Threshold 20 — score 25 is above → rename detected
    let pairs = detect_renames(&[&del], &[&add], &repo, 20).unwrap();
    assert_eq!(pairs.len(), 1);
}

#[test]
fn phase7_test_greedy_pairing_deterministic() {
    use repoanalyze::model::change::{ChangeKind, RawChange};
    use repoanalyze::rename::detect::detect_renames;

    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let repo = gix::open(&repo_path).unwrap();

    // Two deletes, two adds, all with same content (score=100)
    let content = b"identical content\n";
    let blob = repo.write_blob(content).unwrap().detach();
    let zero = gix::ObjectId::null(gix::hash::Kind::Sha1);

    let del_a = RawChange {
        path: "a_old.txt".to_string(),
        old_oid: blob,
        new_oid: zero,
        old_mode: 0o100644,
        new_mode: 0,
        kind: ChangeKind::Delete,
    };
    let del_b = RawChange {
        path: "b_old.txt".to_string(),
        old_oid: blob,
        new_oid: zero,
        old_mode: 0o100644,
        new_mode: 0,
        kind: ChangeKind::Delete,
    };
    let add_x = RawChange {
        path: "x_new.txt".to_string(),
        old_oid: zero,
        new_oid: blob,
        old_mode: 0,
        new_mode: 0o100644,
        kind: ChangeKind::Add,
    };
    let add_y = RawChange {
        path: "y_new.txt".to_string(),
        old_oid: zero,
        new_oid: blob,
        old_mode: 0,
        new_mode: 0o100644,
        kind: ChangeKind::Add,
    };

    // All pairs have score=100. Tie-breaking: old_path asc, then new_path asc.
    // So a_old→x_new should be first, then b_old→y_new.
    let pairs = detect_renames(&[&del_a, &del_b], &[&add_x, &add_y], &repo, 50).unwrap();
    assert_eq!(pairs.len(), 2);
    // First pair: a_old (idx 0) → x_new (idx 0)
    assert_eq!(pairs[0].old_idx, 0);
    assert_eq!(pairs[0].new_idx, 0);
    // Second pair: b_old (idx 1) → y_new (idx 1)
    assert_eq!(pairs[1].old_idx, 1);
    assert_eq!(pairs[1].new_idx, 1);
}

#[test]
fn phase7_test_rename_events_bin() {
    use repoanalyze::model::rename_event::{RenameEvent, RENAME_EVENT_ROW_SIZE};
    use std::path::Path;

    // Build a fixture repo with a rename: commit1 adds "old.txt", commit2 renames to "new.txt"
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = create_rename_repo(tmp.path()).unwrap();

    let out = tempfile::tempdir().unwrap();
    let args = repoanalyze::cli::ScanArgs {
        repo: repo_path,
        out: out.path().to_path_buf(),
        threads: None,
        merge_policy: repoanalyze::cli::MergePolicy::FirstParent,
        renames: repoanalyze::cli::OnOff::On,
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

    let rename_path = out.path().join("tables/rename_events.bin");
    assert!(
        rename_path.exists(),
        "rename_events.bin should exist when renames enabled"
    );

    let data = std::fs::read(&rename_path).unwrap();
    assert_eq!(data.len() % RENAME_EVENT_ROW_SIZE, 0);

    let row_count = data.len() / RENAME_EVENT_ROW_SIZE;
    // Should have at least 1 rename event
    assert!(
        row_count >= 1,
        "should detect at least 1 rename, found {row_count}"
    );

    // Verify roundtrip
    for i in 0..row_count {
        let start = i * RENAME_EVENT_ROW_SIZE;
        let row: &[u8; RENAME_EVENT_ROW_SIZE] = data[start..start + RENAME_EVENT_ROW_SIZE]
            .try_into()
            .unwrap();
        let event = RenameEvent::from_bytes(row);
        assert_eq!(event.is_copy, 0, "should be a rename, not a copy");
        assert!(event.score >= 50, "score should be >= threshold");
    }
}

/// Create a repo with a file rename:
/// Commit 1: adds old.txt with content
/// Commit 2: deletes old.txt, adds new.txt with same content (rename)
fn create_rename_repo(dir: &std::path::Path) -> anyhow::Result<std::path::PathBuf> {
    use gix::date::parse::TimeBuf;
    use gix::objs;

    let repo_path = dir.join("rename-repo");
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init(&repo_path)?;

    let sig = gix::actor::Signature {
        name: "Test Author".into(),
        email: "test@example.com".into(),
        time: gix::date::Time::new(1_700_000_000, 0),
    };

    let content = b"This is the file content.\nLine two.\nLine three.\n";
    let blob = repo.write_blob(content)?.detach();

    // Commit 1: add old.txt
    let tree1 = {
        let tree = objs::Tree {
            entries: vec![objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "old.txt".as_bytes().into(),
                oid: blob,
            }],
        };
        repo.write_object(&tree)?.detach()
    };

    let mut buf = TimeBuf::default();
    let sig_ref = sig.to_ref(&mut buf);
    let commit1 = {
        let c = objs::Commit {
            tree: tree1,
            parents: vec![].into(),
            author: sig_ref.into(),
            committer: sig_ref.into(),
            encoding: None,
            message: "Add old.txt".into(),
            extra_headers: vec![],
        };
        repo.write_object(&c)?.detach()
    };

    // Commit 2: rename old.txt → new.txt (same blob)
    let tree2 = {
        let tree = objs::Tree {
            entries: vec![objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "new.txt".as_bytes().into(),
                oid: blob,
            }],
        };
        repo.write_object(&tree)?.detach()
    };

    let sig2 = gix::actor::Signature {
        name: "Test Author".into(),
        email: "test@example.com".into(),
        time: gix::date::Time::new(1_700_001_000, 0),
    };
    let mut buf2 = TimeBuf::default();
    let sig_ref2 = sig2.to_ref(&mut buf2);
    let commit2 = {
        let c = objs::Commit {
            tree: tree2,
            parents: vec![commit1].into(),
            author: sig_ref2.into(),
            committer: sig_ref2.into(),
            encoding: None,
            message: "Rename old.txt to new.txt".into(),
            extra_headers: vec![],
        };
        repo.write_object(&c)?.detach()
    };

    repo.reference(
        "refs/heads/main",
        commit2,
        gix::refs::transaction::PreviousValue::Any,
        "main",
    )?;
    repo.reference(
        "HEAD",
        commit2,
        gix::refs::transaction::PreviousValue::Any,
        "HEAD",
    )?;

    Ok(repo_path)
}

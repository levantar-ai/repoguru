mod common;

use std::path::Path;

fn run_pipeline(repo_path: &Path, report_on: bool) -> tempfile::TempDir {
    let out = tempfile::tempdir().unwrap();
    let args = repoanalyze::cli::ScanArgs {
        repo: repo_path.to_path_buf(),
        out: out.path().to_path_buf(),
        threads: None,
        merge_policy: repoanalyze::cli::MergePolicy::FirstParent,
        renames: repoanalyze::cli::OnOff::On,
        copies: repoanalyze::cli::OnOff::On,
        rename_threshold: 50,
        include_remotes: repoanalyze::cli::OnOff::Off,
        max_top: 50,
        format: repoanalyze::cli::OutputFormat::Raw,
        report: if report_on {
            repoanalyze::cli::OnOff::On
        } else {
            repoanalyze::cli::OnOff::Off
        },
        telemetry: repoanalyze::cli::OnOff::Off,
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
    repoanalyze::pipeline::run_pipeline(&args).unwrap();
    out
}

fn blake3_file(path: &Path) -> String {
    let data = std::fs::read(path).unwrap();
    blake3::hash(&data).to_hex().to_string()
}

/// Canonicalize JSON: deserialize then re-serialize with sorted keys.
fn canonicalize_json(path: &Path) -> String {
    let content = std::fs::read_to_string(path).unwrap();
    let val: serde_json::Value = serde_json::from_str(&content).unwrap();
    serde_json::to_string_pretty(&val).unwrap()
}

/// Create a medium-sized fixture repo (~50 commits, multiple branches, merges).
fn create_medium_repo(dir: &Path) -> anyhow::Result<std::path::PathBuf> {
    use gix::date::parse::TimeBuf;
    use gix::objs;

    let repo_path = dir.join("medium-repo");
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init(&repo_path)?;

    let mut commits = Vec::new();
    let mut prev: Option<gix::ObjectId> = None;

    // Create 40 linear commits with various changes
    for i in 0..40u32 {
        let author_idx = i % 3;
        let sig = gix::actor::Signature {
            name: format!("Author {author_idx}").into(),
            email: format!("author{author_idx}@example.com").into(),
            time: gix::date::Time::new(1_700_000_000 + (i as i64) * 86400, 0),
        };

        let mut entries = Vec::new();

        // Always have a README
        let readme_content = format!("# Project\nVersion {i}\n");
        let readme_blob = repo.write_blob(readme_content.as_bytes())?.detach();
        entries.push(objs::tree::Entry {
            mode: objs::tree::EntryKind::Blob.into(),
            filename: "README.md".as_bytes().into(),
            oid: readme_blob,
        });

        // Add various files based on commit index
        if i >= 5 {
            let src_content = format!("fn main() {{\n    println!(\"v{i}\");\n}}\n");
            let src_blob = repo.write_blob(src_content.as_bytes())?.detach();
            entries.push(objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "main.rs".as_bytes().into(),
                oid: src_blob,
            });
        }

        if i >= 10 {
            let lib_content = format!("pub fn greet() -> &'static str {{ \"hello v{i}\" }}\n");
            let lib_blob = repo.write_blob(lib_content.as_bytes())?.detach();
            entries.push(objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "lib.rs".as_bytes().into(),
                oid: lib_blob,
            });
        }

        if (20..35).contains(&i) {
            let test_content = format!("#[test]\nfn test_v{i}() {{ assert!(true); }}\n");
            let test_blob = repo.write_blob(test_content.as_bytes())?.detach();
            entries.push(objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "test.rs".as_bytes().into(),
                oid: test_blob,
            });
        }

        entries.sort_by(|a, b| a.filename.cmp(&b.filename));
        let tree = objs::Tree { entries };
        let tree_oid = repo.write_object(&tree)?.detach();

        let parents: Vec<gix::ObjectId> = prev.into_iter().collect();
        let mut buf = TimeBuf::default();
        let sig_ref = sig.to_ref(&mut buf);
        let commit = objs::Commit {
            tree: tree_oid,
            parents: parents.into(),
            author: sig_ref.into(),
            committer: sig_ref.into(),
            encoding: None,
            message: format!("Commit {i}: update files").into(),
            extra_headers: vec![],
        };
        let commit_oid = repo.write_object(&commit)?.detach();

        commits.push(commit_oid);
        prev = Some(commit_oid);
    }

    // Create a branch at commit 20 and merge it at commit 45
    let branch_base = commits[20];
    let branch_sig = gix::actor::Signature {
        name: "Branch Author".into(),
        email: "branch@example.com".into(),
        time: gix::date::Time::new(1_700_000_000 + 41 * 86400, 0),
    };

    let branch_content = b"feature branch content\n";
    let branch_blob = repo.write_blob(branch_content)?.detach();
    let branch_tree = objs::Tree {
        entries: vec![
            objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "README.md".as_bytes().into(),
                oid: branch_blob,
            },
            objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "feature.txt".as_bytes().into(),
                oid: branch_blob,
            },
        ],
    };
    let branch_tree_oid = repo.write_object(&branch_tree)?.detach();

    let mut buf = TimeBuf::default();
    let sig_ref = branch_sig.to_ref(&mut buf);
    let branch_commit = objs::Commit {
        tree: branch_tree_oid,
        parents: vec![branch_base].into(),
        author: sig_ref.into(),
        committer: sig_ref.into(),
        encoding: None,
        message: "Feature branch commit".into(),
        extra_headers: vec![],
    };
    let branch_oid = repo.write_object(&branch_commit)?.detach();

    // Merge commit
    let last_main = *commits.last().unwrap();
    let merge_sig = gix::actor::Signature {
        name: "Author 0".into(),
        email: "author0@example.com".into(),
        time: gix::date::Time::new(1_700_000_000 + 42 * 86400, 0),
    };

    // Merge tree includes feature.txt
    let merge_readme = repo.write_blob(b"# Project\nMerged version\n")?.detach();
    let merge_tree = objs::Tree {
        entries: vec![
            objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "README.md".as_bytes().into(),
                oid: merge_readme,
            },
            objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "feature.txt".as_bytes().into(),
                oid: branch_blob,
            },
            objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: "main.rs".as_bytes().into(),
                oid: repo
                    .write_blob(b"fn main() { println!(\"merged\"); }\n")?
                    .detach(),
            },
        ],
    };
    let merge_tree_oid = repo.write_object(&merge_tree)?.detach();

    let mut buf2 = TimeBuf::default();
    let merge_sig_ref = merge_sig.to_ref(&mut buf2);
    let merge_commit = objs::Commit {
        tree: merge_tree_oid,
        parents: vec![last_main, branch_oid].into(),
        author: merge_sig_ref.into(),
        committer: merge_sig_ref.into(),
        encoding: None,
        message: "Merge feature branch".into(),
        extra_headers: vec![],
    };
    let merge_oid = repo.write_object(&merge_commit)?.detach();

    repo.reference(
        "refs/heads/main",
        merge_oid,
        gix::refs::transaction::PreviousValue::Any,
        "main",
    )?;
    repo.reference(
        "refs/heads/feature",
        branch_oid,
        gix::refs::transaction::PreviousValue::Any,
        "feature",
    )?;
    repo.reference(
        "HEAD",
        merge_oid,
        gix::refs::transaction::PreviousValue::Any,
        "HEAD",
    )?;

    Ok(repo_path)
}

/// Phase 11: deterministic binary output — identical checksums across 2 runs.
/// Note: diff_time_ns varies, so we compare everything except that field.
#[test]
fn phase11_test_deterministic_binary_output() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();

    let out1 = run_pipeline(&repo_path, false);
    let out2 = run_pipeline(&repo_path, false);

    // file_stats.bin should be byte-identical (no timing fields)
    let hash1 = blake3_file(&out1.path().join("tables/file_stats.bin"));
    let hash2 = blake3_file(&out2.path().join("tables/file_stats.bin"));
    assert_eq!(hash1, hash2, "file_stats.bin should be deterministic");

    // For commit_stats.bin, compare with diff_time_ns zeroed out
    let cs1 = zero_diff_time(&std::fs::read(out1.path().join("tables/commit_stats.bin")).unwrap());
    let cs2 = zero_diff_time(&std::fs::read(out2.path().join("tables/commit_stats.bin")).unwrap());
    assert_eq!(
        blake3::hash(&cs1).to_hex().to_string(),
        blake3::hash(&cs2).to_hex().to_string(),
        "commit_stats.bin (minus diff_time_ns) should be deterministic"
    );
}

/// Zero out diff_time_ns (offset 142, 8 bytes) in each 160-byte row.
fn zero_diff_time(data: &[u8]) -> Vec<u8> {
    let row_size = 160;
    let mut result = data.to_vec();
    for i in (0..result.len()).step_by(row_size) {
        if i + 150 <= result.len() {
            result[i + 142..i + 150].fill(0);
        }
    }
    result
}

/// Phase 11: deterministic JSON output — canonicalized JSON matches across runs.
#[test]
fn phase11_test_deterministic_json_output() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();

    let out1 = run_pipeline(&repo_path, true);
    let out2 = run_pipeline(&repo_path, true);

    for fname in [
        "summary.json",
        "timelines.json",
        "authors.json",
        "hotspots.json",
    ] {
        let c1 = canonicalize_json(&out1.path().join(format!("report/data/{fname}")));
        let c2 = canonicalize_json(&out2.path().join(format!("report/data/{fname}")));
        assert_eq!(c1, c2, "{fname} should be deterministic across runs");
    }
}

/// Phase 11: medium repo scans successfully.
#[test]
fn phase11_test_medium_repo_succeeds() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = create_medium_repo(tmp.path()).unwrap();
    let _out = run_pipeline(&repo_path, true);
    // If we get here without panic/error, it succeeded
}

/// Phase 11: medium repo has expected row counts.
#[test]
fn phase11_test_medium_repo_row_counts() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = create_medium_repo(tmp.path()).unwrap();
    let out = run_pipeline(&repo_path, false);

    let cs_data = std::fs::read(out.path().join("tables/commit_stats.bin")).unwrap();
    let commit_rows = cs_data.len() / 160;
    // 40 linear commits + 1 branch commit + 1 merge commit = 42 total
    // First-parent: merge only has first-parent edge, so 42 commits → 42 rows
    assert!(
        commit_rows >= 40,
        "should have at least 40 commit rows, got {commit_rows}"
    );

    let fs_data = std::fs::read(out.path().join("tables/file_stats.bin")).unwrap();
    let file_rows = fs_data.len() / 110;
    assert!(file_rows > 0, "should have file stat rows");
}

/// Phase 11: full acceptance criteria (§0.2).
#[test]
fn phase11_test_full_acceptance_criteria() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = create_medium_repo(tmp.path()).unwrap();
    let out = run_pipeline(&repo_path, true);

    // §0.2.1: Output files exist
    assert!(
        out.path().join("tables/commit_stats.bin").exists(),
        "commit_stats.bin"
    );
    assert!(
        out.path().join("tables/file_stats.bin").exists(),
        "file_stats.bin"
    );
    assert!(out.path().join("metrics.json").exists(), "metrics.json");

    // §0.2.2: metrics.json is valid
    let json_str = std::fs::read_to_string(out.path().join("metrics.json")).unwrap();
    let val: serde_json::Value = serde_json::from_str(&json_str).expect("metrics.json valid JSON");
    let obj = val.as_object().unwrap();
    assert!(
        obj["total_commits"].as_u64().unwrap() > 0,
        "should have commits"
    );
    assert!(
        obj.contains_key("repo_metrics"),
        "should have sizer metrics"
    );

    // §0.2.3: Report exists
    assert!(
        out.path().join("report/index.html").exists(),
        "report/index.html"
    );
    assert!(
        out.path().join("report/data/summary.json").exists(),
        "summary.json"
    );
    assert!(
        out.path().join("report/data/timelines.json").exists(),
        "timelines.json"
    );
    assert!(
        out.path().join("report/data/authors.json").exists(),
        "authors.json"
    );
    assert!(
        out.path().join("report/data/hotspots.json").exists(),
        "hotspots.json"
    );

    // §0.2.4: Binary tables are fixed-width
    let cs = std::fs::read(out.path().join("tables/commit_stats.bin")).unwrap();
    assert_eq!(
        cs.len() % 160,
        0,
        "commit_stats.bin should be multiple of 160"
    );
    let fs = std::fs::read(out.path().join("tables/file_stats.bin")).unwrap();
    assert_eq!(
        fs.len() % 110,
        0,
        "file_stats.bin should be multiple of 110"
    );

    // §0.2.5: No unsafe code (verified by #![forbid(unsafe_code)])
    // §0.2.6: Determinism (covered by other tests)
    // §0.2.7: All report data files parse as valid JSON
    for fname in [
        "summary.json",
        "timelines.json",
        "authors.json",
        "hotspots.json",
    ] {
        let content =
            std::fs::read_to_string(out.path().join(format!("report/data/{fname}"))).unwrap();
        let _: serde_json::Value = serde_json::from_str(&content).unwrap();
    }
}

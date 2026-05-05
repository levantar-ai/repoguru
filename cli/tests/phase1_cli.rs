mod common;

use predicates::prelude::*;

#[test]
fn test_help_flag() {
    common::cmd()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("repoanalyze"));
}

#[test]
fn test_scan_help() {
    common::cmd()
        .args(["scan", "--help"])
        .assert()
        .success()
        .stdout(predicate::str::contains("--repo"));
}

#[test]
fn test_missing_repo() {
    common::cmd().arg("scan").assert().failure().code(2);
}

#[test]
fn test_invalid_merge_policy() {
    common::cmd()
        .args([
            "scan",
            "--repo",
            "/tmp/fake",
            "--out",
            "/tmp/out",
            "--merge-policy",
            "invalid",
        ])
        .assert()
        .failure()
        .code(2);
}

#[test]
fn test_all_defaults_parse() {
    let tmp = tempfile::tempdir().expect("create tempdir");
    let repo_path = common::fixture::create_simple_repo(tmp.path()).expect("create fixture");
    let out = tempfile::tempdir().expect("create tempdir");

    common::cmd()
        .args([
            "scan",
            "--repo",
            repo_path.to_str().unwrap(),
            "--out",
            out.path().to_str().unwrap(),
        ])
        .assert()
        .success();
}

#[test]
fn test_rename_threshold_range() {
    common::cmd()
        .args([
            "scan",
            "--repo",
            "/tmp/fake",
            "--out",
            "/tmp/out",
            "--rename-threshold",
            "101",
        ])
        .assert()
        .failure()
        .code(2);
}

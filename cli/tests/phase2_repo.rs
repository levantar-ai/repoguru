mod common;

use repoanalyze::repo::open::open_repo;
use repoanalyze::repo::refs::collect_tips;

#[test]
fn test_open_worktree() {
    let tmp = tempfile::tempdir().expect("create tempdir");
    let repo_path = common::fixture::create_simple_repo(tmp.path()).expect("create fixture");
    let repo = open_repo(&repo_path);
    assert!(repo.is_ok(), "should open worktree repo: {:?}", repo.err());
}

#[test]
fn test_open_bare() {
    let tmp = tempfile::tempdir().expect("create tempdir");
    let repo_path = common::fixture::create_bare_repo(tmp.path()).expect("create bare fixture");
    let repo = open_repo(&repo_path);
    assert!(repo.is_ok(), "should open bare repo: {:?}", repo.err());
}

#[test]
fn test_open_nonexistent() {
    let result = open_repo(std::path::Path::new("/tmp/nonexistent-repo-xyz"));
    assert!(result.is_err(), "should fail for nonexistent path");
}

#[test]
fn test_collect_tips_head_only() {
    let tmp = tempfile::tempdir().expect("create tempdir");
    let repo_path = common::fixture::create_simple_repo(tmp.path()).expect("create fixture");
    let repo = open_repo(&repo_path).expect("open repo");
    let tips = collect_tips(&repo, false).expect("collect tips");

    // Single branch (main) so we expect 1 tip
    assert!(!tips.is_empty(), "should have at least one tip");
    assert_eq!(
        tips.len(),
        1,
        "single branch = 1 tip (HEAD and main point to same commit)"
    );
}

#[test]
fn test_collect_tips_multiple_branches() {
    let tmp = tempfile::tempdir().expect("create tempdir");
    let repo_path =
        common::fixture::create_multi_branch_repo(tmp.path()).expect("create multi-branch fixture");
    let repo = open_repo(&repo_path).expect("open repo");
    let tips = collect_tips(&repo, false).expect("collect tips");

    // main (commit1), feature (commit2), plus tags (v1.0 -> commit1, lightweight -> commit2)
    // After dedup: commit1 and commit2 = 2 unique tips
    assert_eq!(
        tips.len(),
        2,
        "should have 2 unique commit tips (main+v1.0 dedup, feature+lightweight dedup), got: {}",
        tips.len()
    );
}

#[test]
fn test_peel_annotated_tag() {
    let tmp = tempfile::tempdir().expect("create tempdir");
    let repo_path =
        common::fixture::create_multi_branch_repo(tmp.path()).expect("create multi-branch fixture");
    let repo = open_repo(&repo_path).expect("open repo");
    let tips = collect_tips(&repo, false).expect("collect tips");

    // The annotated tag v1.0 should peel to the same commit as main.
    // We verify this by checking that we get exactly 2 unique tips
    // (the annotated tag and main should collapse to the same OID).
    assert_eq!(
        tips.len(),
        2,
        "annotated tag should peel to commit, deduping with main"
    );

    // All tips should be commit objects
    for tip in &tips {
        let obj = repo.find_object(*tip).expect("find object");
        assert_eq!(
            obj.kind,
            gix::object::Kind::Commit,
            "all tips should be commits, got {:?} for {tip}",
            obj.kind
        );
    }
}

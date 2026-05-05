mod common;

use repoanalyze::cli::MergePolicy;
use repoanalyze::repo::open::open_repo;
use repoanalyze::repo::refs::collect_tips;
use repoanalyze::walk::revwalk::deterministic_walk;
use repoanalyze::walk::workitem::{expand_to_workitems, ZERO_OID};

#[test]
fn test_linear_order() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo_path, expected_oids) = common::fixture::create_linear_repo(tmp.path(), 5).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let walked = deterministic_walk(&repo, &tips).unwrap();

    assert_eq!(walked.len(), 5, "should walk all 5 commits");
    // Linear history: should be in creation order (oldest first)
    assert_eq!(
        walked, expected_oids,
        "linear walk should match creation order"
    );
}

#[test]
fn test_merge_order() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo_path, oids) = common::fixture::create_diamond_merge_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let walked = deterministic_walk(&repo, &tips).unwrap();

    let [a, _b, _c, d] = [oids[0], oids[1], oids[2], oids[3]];

    assert_eq!(walked.len(), 4, "should walk all 4 commits");
    // A must come first (root), D must come last (depends on B and C)
    assert_eq!(walked[0], a, "root commit A should be first");
    assert_eq!(walked[3], d, "merge commit D should be last");

    // B and C can be in either order, but must be deterministic
    // Run again to verify
    let walked2 = deterministic_walk(&repo, &tips).unwrap();
    assert_eq!(walked, walked2, "walk order must be deterministic");
}

#[test]
fn test_root_commit_zero_parent() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo_path, _oids) = common::fixture::create_linear_repo(tmp.path(), 3).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let walked = deterministic_walk(&repo, &tips).unwrap();
    let items = expand_to_workitems(&walked, &repo, MergePolicy::FirstParent).unwrap();

    // First item (root commit) should have parent_oid = ZERO_OID
    assert_eq!(
        items[0].parent_oid, ZERO_OID,
        "root commit should have ZERO_OID parent"
    );
    assert_eq!(items[0].parents_count, 0);
    assert!(!items[0].is_merge);
}

#[test]
fn test_first_parent_workitems() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo_path, oids) = common::fixture::create_diamond_merge_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let walked = deterministic_walk(&repo, &tips).unwrap();
    let items = expand_to_workitems(&walked, &repo, MergePolicy::FirstParent).unwrap();

    // 4 commits → 4 WorkItems in first-parent mode
    assert_eq!(items.len(), 4, "first-parent: one WorkItem per commit");

    // Find the merge commit D's WorkItem
    let d_item = items.iter().find(|wi| wi.commit_oid == oids[3]).unwrap();
    assert!(d_item.is_merge);
    assert_eq!(d_item.parents_count, 2);
    // First parent of D is B (oids[1])
    assert_eq!(
        d_item.parent_oid, oids[1],
        "first-parent of merge should be B"
    );

    // Seq values strictly increasing
    for (i, item) in items.iter().enumerate() {
        assert_eq!(item.seq, i as u64, "seq should be monotonically increasing");
    }
}

#[test]
fn test_all_parents_workitems() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo_path, oids) = common::fixture::create_diamond_merge_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();
    let walked = deterministic_walk(&repo, &tips).unwrap();
    let items = expand_to_workitems(&walked, &repo, MergePolicy::AllParents).unwrap();

    // A (root=1) + B (1 parent=1) + C (1 parent=1) + D (2 parents=2) = 5 WorkItems
    assert_eq!(items.len(), 5, "all-parents: merge D produces 2 WorkItems");

    // D should have 2 WorkItems
    let d_items: Vec<_> = items.iter().filter(|wi| wi.commit_oid == oids[3]).collect();
    assert_eq!(d_items.len(), 2, "merge D should have 2 WorkItems");
    assert_eq!(d_items[0].parent_oid, oids[1], "first parent of D is B");
    assert_eq!(d_items[1].parent_oid, oids[2], "second parent of D is C");

    // Seq values strictly increasing
    for (i, item) in items.iter().enumerate() {
        assert_eq!(item.seq, i as u64);
    }
}

#[test]
fn test_deterministic_across_runs() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo_path, _) = common::fixture::create_diamond_merge_repo(tmp.path()).unwrap();
    let repo = open_repo(&repo_path).unwrap();
    let tips = collect_tips(&repo, false).unwrap();

    let walk1 = deterministic_walk(&repo, &tips).unwrap();
    let walk2 = deterministic_walk(&repo, &tips).unwrap();
    let walk3 = deterministic_walk(&repo, &tips).unwrap();

    assert_eq!(walk1, walk2, "walk must be deterministic (run 1 vs 2)");
    assert_eq!(walk2, walk3, "walk must be deterministic (run 2 vs 3)");
}

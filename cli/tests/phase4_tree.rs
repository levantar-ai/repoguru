mod common;

use repoanalyze::diff::binary::is_binary;
use repoanalyze::diff::tree_delta::compute_tree_delta;
use repoanalyze::model::change::ChangeKind;
use repoanalyze::repo::open::open_repo;

/// Helper: create a repo and return (repo, tree_oid) for a given set of file entries.
fn make_tree(
    dir: &std::path::Path,
    name: &str,
    entries: &[(&str, &[u8])],
) -> (gix::Repository, gix::ObjectId) {
    let repo_path = dir.join(name);
    std::fs::create_dir_all(&repo_path).unwrap();
    let repo = gix::init(&repo_path).unwrap();

    let blob_entries: Vec<(&str, gix::ObjectId)> = entries
        .iter()
        .map(|(path, content)| {
            let oid = repo.write_blob(*content).unwrap().detach();
            (*path, oid)
        })
        .collect();

    let tree_oid = common::fixture::write_nested_tree(&repo, &blob_entries).unwrap();
    (repo, tree_oid)
}

#[test]
fn test_add_file() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo, empty_tree) = make_tree(tmp.path(), "add-repo", &[]);
    let blob = repo.write_blob(b"hello\n").unwrap().detach();
    let new_tree = common::fixture::write_nested_tree(&repo, &[("file.txt", blob)]).unwrap();

    let changes = compute_tree_delta(&repo, Some(empty_tree), new_tree).unwrap();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].kind, ChangeKind::Add);
    assert_eq!(changes[0].path, "file.txt");
}

#[test]
fn test_delete_file() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo, _) = make_tree(tmp.path(), "del-repo", &[]);
    let blob = repo.write_blob(b"hello\n").unwrap().detach();
    let old_tree = common::fixture::write_nested_tree(&repo, &[("file.txt", blob)]).unwrap();
    let new_tree = common::fixture::write_nested_tree(&repo, &[]).unwrap();

    let changes = compute_tree_delta(&repo, Some(old_tree), new_tree).unwrap();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].kind, ChangeKind::Delete);
    assert_eq!(changes[0].path, "file.txt");
}

#[test]
fn test_modify_file() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo, _) = make_tree(tmp.path(), "mod-repo", &[]);
    let blob1 = repo.write_blob(b"version 1\n").unwrap().detach();
    let blob2 = repo.write_blob(b"version 2\n").unwrap().detach();
    let old_tree = common::fixture::write_nested_tree(&repo, &[("file.txt", blob1)]).unwrap();
    let new_tree = common::fixture::write_nested_tree(&repo, &[("file.txt", blob2)]).unwrap();

    let changes = compute_tree_delta(&repo, Some(old_tree), new_tree).unwrap();
    assert_eq!(changes.len(), 1);
    assert_eq!(changes[0].kind, ChangeKind::Modify);
    assert_eq!(changes[0].path, "file.txt");
}

#[test]
fn test_nested_directory() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo, _) = make_tree(tmp.path(), "nest-repo", &[]);
    let blob1 = repo.write_blob(b"old\n").unwrap().detach();
    let blob2 = repo.write_blob(b"new\n").unwrap().detach();
    let blob_keep = repo.write_blob(b"keep\n").unwrap().detach();

    let old_tree = common::fixture::write_nested_tree(
        &repo,
        &[("src/main.rs", blob1), ("src/lib.rs", blob_keep)],
    )
    .unwrap();

    let new_tree = common::fixture::write_nested_tree(
        &repo,
        &[
            ("src/main.rs", blob2),
            ("src/lib.rs", blob_keep),
            ("src/util.rs", blob2),
        ],
    )
    .unwrap();

    let changes = compute_tree_delta(&repo, Some(old_tree), new_tree).unwrap();

    // main.rs modified, util.rs added, lib.rs unchanged
    assert_eq!(changes.len(), 2);

    let modify = changes.iter().find(|c| c.path == "src/main.rs").unwrap();
    assert_eq!(modify.kind, ChangeKind::Modify);

    let add = changes.iter().find(|c| c.path == "src/util.rs").unwrap();
    assert_eq!(add.kind, ChangeKind::Add);
}

#[test]
fn test_binary_detection_nul() {
    assert!(is_binary(&[0x48, 0x65, 0x00, 0x6c])); // "He\0l"
    assert!(is_binary(&[0; 100])); // all NULs
}

#[test]
fn test_binary_detection_text() {
    assert!(!is_binary(b"Hello, world!\n"));
    assert!(!is_binary(b""));
    assert!(!is_binary(b"line1\nline2\nline3\n"));
}

#[test]
fn test_root_commit_all_adds() {
    let tmp = tempfile::tempdir().unwrap();
    let (repo, _) = make_tree(tmp.path(), "root-repo", &[]);
    let blob1 = repo.write_blob(b"a\n").unwrap().detach();
    let blob2 = repo.write_blob(b"b\n").unwrap().detach();
    let tree =
        common::fixture::write_nested_tree(&repo, &[("a.txt", blob1), ("b.txt", blob2)]).unwrap();

    // old_tree = None means root commit
    let changes = compute_tree_delta(&repo, None, tree).unwrap();
    assert_eq!(changes.len(), 2);
    assert!(changes.iter().all(|c| c.kind == ChangeKind::Add));

    // Sorted by path
    assert_eq!(changes[0].path, "a.txt");
    assert_eq!(changes[1].path, "b.txt");
}

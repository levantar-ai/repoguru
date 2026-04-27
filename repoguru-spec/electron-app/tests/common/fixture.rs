//! Programmatic fixture repo creation using gix.
//!
//! Creates test repositories without invoking the `git` CLI.

use std::path::{Path, PathBuf};

use gix::date::parse::TimeBuf;
use gix::objs;

fn make_sig(time_secs: i64) -> gix::actor::Signature {
    gix::actor::Signature {
        name: "Test Author".into(),
        email: "test@example.com".into(),
        time: gix::date::Time::new(time_secs, 0),
    }
}

/// Write a flat tree (no subdirectories) from name/blob pairs.
fn write_tree(
    repo: &gix::Repository,
    entries: &[(&str, gix::ObjectId)],
) -> anyhow::Result<gix::ObjectId> {
    let mut sorted: Vec<_> = entries.to_vec();
    sorted.sort_by(|a, b| a.0.cmp(b.0));

    let tree = objs::Tree {
        entries: sorted
            .iter()
            .map(|(name, oid)| objs::tree::Entry {
                mode: objs::tree::EntryKind::Blob.into(),
                filename: name.as_bytes().into(),
                oid: *oid,
            })
            .collect(),
    };

    let oid = repo.write_object(&tree)?;
    Ok(oid.detach())
}

/// Write a commit object.
fn write_commit(
    repo: &gix::Repository,
    tree: gix::ObjectId,
    parents: &[gix::ObjectId],
    sig: gix::actor::Signature,
    message: &str,
) -> anyhow::Result<gix::ObjectId> {
    let mut buf = TimeBuf::default();
    let sig_ref = sig.to_ref(&mut buf);
    let commit = objs::Commit {
        tree,
        parents: parents.iter().copied().collect(),
        author: sig_ref.into(),
        committer: sig_ref.into(),
        encoding: None,
        message: message.into(),
        extra_headers: vec![],
    };

    let oid = repo.write_object(&commit)?;
    Ok(oid.detach())
}

/// Write an annotated tag object.
fn write_tag(
    repo: &gix::Repository,
    target: gix::ObjectId,
    tag_name: &str,
    sig: gix::actor::Signature,
    message: &str,
) -> anyhow::Result<gix::ObjectId> {
    let mut buf = TimeBuf::default();
    let sig_ref = sig.to_ref(&mut buf);
    let tag = objs::Tag {
        target,
        target_kind: objs::Kind::Commit,
        name: tag_name.into(),
        tagger: Some(sig_ref.into()),
        message: message.into(),
        pgp_signature: None,
    };

    let oid = repo.write_object(&tag)?;
    Ok(oid.detach())
}

/// Create a simple git repository with 3 commits.
///
/// - Commit 1 (root): adds `hello.txt`
/// - Commit 2: modifies `hello.txt`, adds `world.txt`
/// - Commit 3: deletes `world.txt`
pub fn create_simple_repo(dir: &Path) -> anyhow::Result<PathBuf> {
    let repo_path = dir.join("test-repo");
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init(&repo_path)?;

    let hello_blob = repo.write_blob(b"Hello, world!\n")?.detach();
    let tree1 = write_tree(&repo, &[("hello.txt", hello_blob)])?;
    let commit1 = write_commit(
        &repo,
        tree1,
        &[],
        make_sig(1_700_000_000),
        "Initial commit: add hello.txt",
    )?;

    let hello_blob2 = repo.write_blob(b"Hello, modified world!\n")?.detach();
    let world_blob = repo.write_blob(b"World content\n")?.detach();
    let tree2 = write_tree(
        &repo,
        &[("hello.txt", hello_blob2), ("world.txt", world_blob)],
    )?;
    let commit2 = write_commit(
        &repo,
        tree2,
        &[commit1],
        make_sig(1_700_001_000),
        "Modify hello, add world",
    )?;

    let tree3 = write_tree(&repo, &[("hello.txt", hello_blob2)])?;
    let commit3 = write_commit(
        &repo,
        tree3,
        &[commit2],
        make_sig(1_700_002_000),
        "Delete world.txt",
    )?;

    repo.reference(
        "refs/heads/main",
        commit3,
        gix::refs::transaction::PreviousValue::Any,
        "create main branch",
    )?;
    repo.reference(
        "HEAD",
        commit3,
        gix::refs::transaction::PreviousValue::Any,
        "set HEAD",
    )?;

    Ok(repo_path)
}

/// Create a bare git repository with a single commit.
pub fn create_bare_repo(dir: &Path) -> anyhow::Result<PathBuf> {
    let repo_path = dir.join("bare-repo.git");
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init_bare(&repo_path)?;

    let hello_blob = repo.write_blob(b"Hello from bare\n")?.detach();
    let tree = write_tree(&repo, &[("hello.txt", hello_blob)])?;
    let commit = write_commit(
        &repo,
        tree,
        &[],
        make_sig(1_700_000_000),
        "Initial commit in bare repo",
    )?;

    repo.reference(
        "refs/heads/main",
        commit,
        gix::refs::transaction::PreviousValue::Any,
        "create main branch",
    )?;

    Ok(repo_path)
}

/// Create a repo with multiple branches and an annotated tag.
pub fn create_multi_branch_repo(dir: &Path) -> anyhow::Result<PathBuf> {
    let repo_path = dir.join("multi-repo");
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init(&repo_path)?;

    let blob1 = repo.write_blob(b"main content\n")?.detach();
    let tree1 = write_tree(&repo, &[("file.txt", blob1)])?;
    let commit1 = write_commit(
        &repo,
        tree1,
        &[],
        make_sig(1_700_000_000),
        "Initial on main",
    )?;

    let blob2 = repo.write_blob(b"feature content\n")?.detach();
    let tree2 = write_tree(&repo, &[("file.txt", blob2)])?;
    let commit2 = write_commit(
        &repo,
        tree2,
        &[commit1],
        make_sig(1_700_001_000),
        "Feature commit",
    )?;

    repo.reference(
        "refs/heads/main",
        commit1,
        gix::refs::transaction::PreviousValue::Any,
        "main",
    )?;
    repo.reference(
        "refs/heads/feature",
        commit2,
        gix::refs::transaction::PreviousValue::Any,
        "feature",
    )?;

    let tag_oid = write_tag(
        &repo,
        commit1,
        "v1.0",
        make_sig(1_700_000_000),
        "Release v1.0",
    )?;
    repo.reference(
        "refs/tags/v1.0",
        tag_oid,
        gix::refs::transaction::PreviousValue::Any,
        "annotated tag",
    )?;
    repo.reference(
        "refs/tags/lightweight",
        commit2,
        gix::refs::transaction::PreviousValue::Any,
        "lightweight tag",
    )?;

    repo.reference(
        "HEAD",
        commit1,
        gix::refs::transaction::PreviousValue::Any,
        "set HEAD",
    )?;

    Ok(repo_path)
}

/// Write a tree with nested directories from path/blob pairs.
/// Paths can contain "/" for subdirectories (e.g., "src/main.rs").
pub fn write_nested_tree(
    repo: &gix::Repository,
    entries: &[(&str, gix::ObjectId)],
) -> anyhow::Result<gix::ObjectId> {
    use std::collections::BTreeMap;

    // Group entries by first path component
    let mut dirs: BTreeMap<String, Vec<(String, gix::ObjectId)>> = BTreeMap::new();
    let mut files: Vec<(String, gix::ObjectId)> = Vec::new();

    for (path, oid) in entries {
        if let Some((dir, rest)) = path.split_once('/') {
            dirs.entry(dir.to_string())
                .or_default()
                .push((rest.to_string(), *oid));
        } else {
            files.push((path.to_string(), *oid));
        }
    }

    let mut tree_entries = Vec::new();

    // Add file entries
    for (name, oid) in &files {
        tree_entries.push(objs::tree::Entry {
            mode: objs::tree::EntryKind::Blob.into(),
            filename: name.as_bytes().into(),
            oid: *oid,
        });
    }

    // Add directory entries (recursively build subtrees)
    for (dir_name, sub_entries) in &dirs {
        let sub_pairs: Vec<(&str, gix::ObjectId)> =
            sub_entries.iter().map(|(p, o)| (p.as_str(), *o)).collect();
        let sub_tree_oid = write_nested_tree(repo, &sub_pairs)?;
        tree_entries.push(objs::tree::Entry {
            mode: objs::tree::EntryKind::Tree.into(),
            filename: dir_name.as_bytes().into(),
            oid: sub_tree_oid,
        });
    }

    tree_entries.sort_by(|a, b| a.filename.cmp(&b.filename));

    let tree = objs::Tree {
        entries: tree_entries,
    };
    let oid = repo.write_object(&tree)?;
    Ok(oid.detach())
}

/// Create a 5-commit linear repo (for revwalk testing).
/// Returns (repo_path, Vec of commit OIDs in creation order oldest→newest).
pub fn create_linear_repo(
    dir: &Path,
    count: usize,
) -> anyhow::Result<(PathBuf, Vec<gix::ObjectId>)> {
    let repo_path = dir.join("linear-repo");
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init(&repo_path)?;

    let mut commits = Vec::new();
    let mut prev: Option<gix::ObjectId> = None;

    for i in 0..count {
        let content = format!("content {i}\n");
        let blob = repo.write_blob(content.as_bytes())?.detach();
        let tree = write_tree(&repo, &[("file.txt", blob)])?;
        let parents: Vec<gix::ObjectId> = prev.into_iter().collect();
        let commit = write_commit(
            &repo,
            tree,
            &parents,
            make_sig(1_700_000_000 + (i as i64) * 1000),
            &format!("Commit {i}"),
        )?;
        commits.push(commit);
        prev = Some(commit);
    }

    let last = *commits.last().expect("at least one commit");
    repo.reference(
        "refs/heads/main",
        last,
        gix::refs::transaction::PreviousValue::Any,
        "main",
    )?;
    repo.reference(
        "HEAD",
        last,
        gix::refs::transaction::PreviousValue::Any,
        "HEAD",
    )?;

    Ok((repo_path, commits))
}

/// Create a diamond merge repo:
/// ```text
///   A --- B --- D (merge of B and C)
///    \        /
///     --- C --
/// ```
/// Returns (repo_path, [A, B, C, D] OIDs).
pub fn create_diamond_merge_repo(dir: &Path) -> anyhow::Result<(PathBuf, Vec<gix::ObjectId>)> {
    let repo_path = dir.join("diamond-repo");
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init(&repo_path)?;

    // A: root
    let blob_a = repo.write_blob(b"root\n")?.detach();
    let tree_a = write_tree(&repo, &[("file.txt", blob_a)])?;
    let a = write_commit(&repo, tree_a, &[], make_sig(1_700_000_000), "Commit A")?;

    // B: child of A (left branch)
    let blob_b = repo.write_blob(b"left\n")?.detach();
    let tree_b = write_tree(&repo, &[("file.txt", blob_b)])?;
    let b = write_commit(&repo, tree_b, &[a], make_sig(1_700_001_000), "Commit B")?;

    // C: child of A (right branch)
    let blob_c = repo.write_blob(b"right\n")?.detach();
    let tree_c = write_tree(&repo, &[("file.txt", blob_c), ("other.txt", blob_c)])?;
    let c = write_commit(&repo, tree_c, &[a], make_sig(1_700_002_000), "Commit C")?;

    // D: merge of B and C (B is first parent)
    let blob_d = repo.write_blob(b"merged\n")?.detach();
    let tree_d = write_tree(&repo, &[("file.txt", blob_d), ("other.txt", blob_c)])?;
    let d = write_commit(
        &repo,
        tree_d,
        &[b, c],
        make_sig(1_700_003_000),
        "Merge B and C",
    )?;

    repo.reference(
        "refs/heads/main",
        d,
        gix::refs::transaction::PreviousValue::Any,
        "main",
    )?;
    repo.reference(
        "HEAD",
        d,
        gix::refs::transaction::PreviousValue::Any,
        "HEAD",
    )?;

    Ok((repo_path, vec![a, b, c, d]))
}

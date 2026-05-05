use std::path::Path;

use crossbeam_channel::{Receiver, Sender};
use gix::ObjectId;

use crate::diff::binary::is_binary;
use crate::diff::line_diff::{compute_line_stats, BINARY_SENTINEL};
use crate::diff::tree_delta::compute_tree_delta_with_limit;
use crate::model::change::{ChangeKind, RawChange};
use crate::rename::detect::{detect_copies, detect_renames};
use crate::walk::workitem::{WorkItem, ZERO_OID};

/// Result of diffing a single WorkItem.
#[derive(Debug)]
pub struct DiffResult {
    pub seq: u64,
    pub commit_oid: ObjectId,
    pub parent_oid: ObjectId,
    pub tree_oid: ObjectId,
    pub parent_tree_oid: ObjectId,
    pub author_key: String,
    pub committer_key: String,
    pub author_ts: i64,
    pub commit_ts: i64,
    pub message_len: u32,
    pub parents_count: u8,
    pub is_merge: bool,
    pub changes: Vec<FileChange>,
    pub rename_pairs: Vec<RenameInfo>,
    pub copy_pairs: Vec<CopyInfo>,
    pub diff_time_ns: u64,
    /// True if tree diff was truncated (hit max_diff_files limit).
    pub tree_truncated: bool,
    /// First line of commit message, capped at 200 bytes.
    pub message_subject: String,
}

/// Per-file change with line stats.
#[derive(Debug)]
pub struct FileChange {
    pub raw: RawChange,
    pub is_binary: bool,
    pub insertions: u32,
    pub deletions: u32,
    /// True if Myers diff bailed out due to cost budget.
    pub diff_bailed_out: bool,
}

/// Rename info carried from worker to aggregator.
#[derive(Debug)]
pub struct RenameInfo {
    pub old_path: String,
    pub new_path: String,
    pub score: u16,
}

/// Copy info carried from worker to aggregator.
#[derive(Debug)]
pub struct CopyInfo {
    pub old_path: String,
    pub new_path: String,
    pub score: u16,
}

/// Worker configuration for rename/copy detection.
#[derive(Debug, Clone)]
pub struct WorkerConfig {
    pub renames_enabled: bool,
    pub copies_enabled: bool,
    pub rename_threshold: u16,
    /// Max file changes per commit before skipping line-level diff (memory safety).
    /// Commits exceeding this are still counted but file changes are marked binary.
    pub max_diff_files: usize,
    /// Max file changes for merge commits (merge diffs are redundant with parent commits).
    pub merge_diff_limit: usize,
    /// Object cache size in bytes for each worker's repo handle.
    pub worker_cache_bytes: usize,
}

/// Pull WorkItems, compute diffs, push results (§9).
/// Opens its own repo handle to avoid locks.
pub fn run_worker(
    repo_path: &Path,
    rx: Receiver<WorkItem>,
    tx: Sender<DiffResult>,
    config: &WorkerConfig,
) {
    let mut repo = match gix::open(repo_path) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Worker failed to open repo: {e}");
            return;
        }
    };
    // Enable object cache — critical for tree diff performance.
    // Without this, every subtree lookup decompresses from pack files.
    repo.object_cache_size_if_unset(config.worker_cache_bytes);

    for item in rx {
        let start = std::time::Instant::now();

        let result = process_work_item(&repo, &item, config);

        match result {
            Ok(mut dr) => {
                dr.diff_time_ns = start.elapsed().as_nanos() as u64;
                if tx.send(dr).is_err() {
                    break;
                }
            }
            Err(e) => {
                eprintln!("Worker error on seq {}: {e}", item.seq);
            }
        }
    }
}

fn process_work_item(
    repo: &gix::Repository,
    item: &WorkItem,
    config: &WorkerConfig,
) -> Result<DiffResult, crate::error::ScanError> {
    let commit_obj = repo
        .find_object(item.commit_oid)
        .map_err(|e| crate::error::ScanError::ScanFailed(format!("find commit: {e}")))?;
    let commit = commit_obj
        .try_into_commit()
        .map_err(|e| crate::error::ScanError::ScanFailed(format!("parse commit: {e}")))?;

    let tree_oid = commit
        .tree_id()
        .map_err(|e| crate::error::ScanError::ScanFailed(format!("get tree: {e}")))?
        .detach();

    // Get parent tree
    let parent_tree_oid = if item.parent_oid == ZERO_OID {
        None
    } else {
        let parent_obj = repo
            .find_object(item.parent_oid)
            .map_err(|e| crate::error::ScanError::ScanFailed(format!("find parent: {e}")))?;
        let parent_commit = parent_obj
            .try_into_commit()
            .map_err(|e| crate::error::ScanError::ScanFailed(format!("parse parent: {e}")))?;
        Some(
            parent_commit
                .tree_id()
                .map_err(|e| crate::error::ScanError::ScanFailed(format!("get parent tree: {e}")))?
                .detach(),
        )
    };

    // Compute tree delta with early bail-out for mega-commits.
    // Merge commits get a much lower limit — their real value is conflict
    // resolution (always small); bulk changes are captured by individual commits.
    let tree_limit = if item.is_merge {
        config.max_diff_files.min(config.merge_diff_limit)
    } else {
        config.max_diff_files
    };
    let delta = compute_tree_delta_with_limit(repo, parent_tree_oid, tree_oid, tree_limit)?;

    let tree_truncated = delta.truncated;
    let skip_diff = tree_truncated;
    let raw_changes = delta.changes;
    let mut changes = Vec::with_capacity(raw_changes.len());
    for raw in raw_changes {
        if skip_diff {
            changes.push(FileChange {
                raw,
                is_binary: true,
                insertions: BINARY_SENTINEL,
                deletions: BINARY_SENTINEL,
                diff_bailed_out: true,
            });
        } else {
            let stats = compute_change_stats(repo, &raw)?;
            changes.push(FileChange {
                raw,
                is_binary: stats.0,
                insertions: stats.1,
                deletions: stats.2,
                diff_bailed_out: stats.3,
            });
        }
    }

    // Rename/copy detection
    let mut rename_pairs = Vec::new();
    let mut copy_pairs = Vec::new();

    if config.renames_enabled && !skip_diff {
        // Collect indices and cloned RawChanges to avoid borrow issues
        let del_indices: Vec<usize> = changes
            .iter()
            .enumerate()
            .filter(|(_, c)| c.raw.kind == ChangeKind::Delete)
            .map(|(i, _)| i)
            .collect();
        let add_indices: Vec<usize> = changes
            .iter()
            .enumerate()
            .filter(|(_, c)| c.raw.kind == ChangeKind::Add)
            .map(|(i, _)| i)
            .collect();

        let del_raws: Vec<&RawChange> = del_indices.iter().map(|&i| &changes[i].raw).collect();
        let add_raws: Vec<&RawChange> = add_indices.iter().map(|&i| &changes[i].raw).collect();

        let pairs = detect_renames(&del_raws, &add_raws, repo, config.rename_threshold)?;

        // Collect update instructions (owned data)
        struct RenameUpdate {
            add_change_idx: usize,
            del_change_idx: usize,
            old_path: String,
            new_path: String,
            score: u16,
        }
        let mut updates: Vec<RenameUpdate> = Vec::new();
        for pair in &pairs {
            updates.push(RenameUpdate {
                add_change_idx: add_indices[pair.new_idx],
                del_change_idx: del_indices[pair.old_idx],
                old_path: changes[del_indices[pair.old_idx]].raw.path.clone(),
                new_path: changes[add_indices[pair.new_idx]].raw.path.clone(),
                score: pair.score,
            });
        }

        // Apply rename updates
        let mut consumed_del_indices = std::collections::BTreeSet::new();
        for upd in &updates {
            // Copy old info from the delete entry
            let old_oid = changes[upd.del_change_idx].raw.old_oid;
            let old_mode = changes[upd.del_change_idx].raw.old_mode;

            // Update the add entry to Rename
            changes[upd.add_change_idx].raw.kind = ChangeKind::Rename;
            changes[upd.add_change_idx].raw.old_oid = old_oid;
            changes[upd.add_change_idx].raw.old_mode = old_mode;

            consumed_del_indices.insert(upd.del_change_idx);
            rename_pairs.push(RenameInfo {
                old_path: upd.old_path.clone(),
                new_path: upd.new_path.clone(),
                score: upd.score,
            });
        }

        // Remove consumed deletes (in reverse to preserve indices)
        let mut del_idx_vec: Vec<usize> = consumed_del_indices.into_iter().collect();
        del_idx_vec.sort_unstable_by(|a, b| b.cmp(a));
        for idx in del_idx_vec {
            changes.remove(idx);
        }

        // Copy detection
        if config.copies_enabled {
            let remaining_add_indices: Vec<usize> = changes
                .iter()
                .enumerate()
                .filter(|(_, c)| c.raw.kind == ChangeKind::Add)
                .map(|(i, _)| i)
                .collect();
            let old_file_indices: Vec<usize> = changes
                .iter()
                .enumerate()
                .filter(|(_, c)| {
                    c.raw.kind == ChangeKind::Modify || c.raw.kind == ChangeKind::TypeChange
                })
                .map(|(i, _)| i)
                .collect();

            let rem_add_raws: Vec<&RawChange> = remaining_add_indices
                .iter()
                .map(|&i| &changes[i].raw)
                .collect();
            let old_raws: Vec<&RawChange> =
                old_file_indices.iter().map(|&i| &changes[i].raw).collect();

            let cpairs = detect_copies(&rem_add_raws, &old_raws, repo, config.rename_threshold)?;

            // Collect copy updates
            struct CopyUpdate {
                add_change_idx: usize,
                old_path: String,
                new_path: String,
                score: u16,
            }
            let mut copy_updates: Vec<CopyUpdate> = Vec::new();
            for cpair in &cpairs {
                copy_updates.push(CopyUpdate {
                    add_change_idx: remaining_add_indices[cpair.new_idx],
                    old_path: changes[old_file_indices[cpair.old_idx]].raw.path.clone(),
                    new_path: changes[remaining_add_indices[cpair.new_idx]]
                        .raw
                        .path
                        .clone(),
                    score: cpair.score,
                });
            }

            for cupd in &copy_updates {
                changes[cupd.add_change_idx].raw.kind = ChangeKind::Copy;
                copy_pairs.push(CopyInfo {
                    old_path: cupd.old_path.clone(),
                    new_path: cupd.new_path.clone(),
                    score: cupd.score,
                });
            }
        }
    }

    // Extract author/committer info
    let author = commit
        .author()
        .map_err(|e| crate::error::ScanError::ScanFailed(format!("get author: {e}")))?;
    let committer = commit
        .committer()
        .map_err(|e| crate::error::ScanError::ScanFailed(format!("get committer: {e}")))?;

    let author_key = canonical_author_key(
        &String::from_utf8_lossy(author.name),
        &String::from_utf8_lossy(author.email),
    );
    let committer_key = canonical_author_key(
        &String::from_utf8_lossy(committer.name),
        &String::from_utf8_lossy(committer.email),
    );

    let author_ts = author.time().map(|t| t.seconds).unwrap_or(0);
    let commit_ts = committer.time().map(|t| t.seconds).unwrap_or(0);
    let raw_msg = commit.message_raw_sloppy();
    let message_len = raw_msg.len() as u32;

    // Extract first line of commit message, capped at 200 bytes
    let msg_str = String::from_utf8_lossy(raw_msg);
    let subject = msg_str.lines().next().unwrap_or("");
    let message_subject = if subject.len() > 200 {
        subject[..200].to_string()
    } else {
        subject.to_string()
    };

    Ok(DiffResult {
        seq: item.seq,
        commit_oid: item.commit_oid,
        parent_oid: item.parent_oid,
        tree_oid,
        parent_tree_oid: parent_tree_oid.unwrap_or(ZERO_OID),
        author_key,
        committer_key,
        author_ts,
        commit_ts,
        message_len,
        parents_count: item.parents_count,
        is_merge: item.is_merge,
        changes,
        rename_pairs,
        copy_pairs,
        diff_time_ns: 0,
        tree_truncated,
        message_subject,
    })
}

/// Returns (is_binary, insertions, deletions, bailed_out)
fn compute_change_stats(
    repo: &gix::Repository,
    raw: &RawChange,
) -> Result<(bool, u32, u32, bool), crate::error::ScanError> {
    let zero = ZERO_OID;

    let old_data = if raw.old_oid != zero {
        repo.find_object(raw.old_oid)
            .map(|o| o.data.to_vec())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let new_data = if raw.new_oid != zero {
        repo.find_object(raw.new_oid)
            .map(|o| o.data.to_vec())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let bin = is_binary(&old_data) || is_binary(&new_data);
    if bin {
        return Ok((true, BINARY_SENTINEL, BINARY_SENTINEL, false));
    }

    let stats = compute_line_stats(&old_data, &new_data);
    Ok((false, stats.insertions, stats.deletions, stats.bailed_out))
}

/// Canonical author key (§6.2).
fn canonical_author_key(name: &str, email: &str) -> String {
    let email_lower = email.to_lowercase();
    if !email_lower.is_empty() {
        email_lower
    } else {
        format!("{name}\0{email}")
    }
}

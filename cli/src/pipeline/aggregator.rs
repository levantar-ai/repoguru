use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufWriter, Write as IoWrite};
use std::path::Path;
use std::sync::Arc;

use crossbeam_channel::Receiver;

use crate::error::ScanError;
use crate::model::commit_stat::CommitStat;
use crate::model::file_stat::FileStat;
use crate::model::rename_event::RenameEvent;
use crate::pipeline::worker::DiffResult;
use crate::telemetry::ScanLog;
use crate::writer::binary_writer::BinWriter;
use crate::writer::json_writer::Metrics;

/// Run the aggregator: reorder results by seq, assign IDs, write output (§9).
///
/// Returns (Metrics, commit_count, file_change_count).
pub fn run_aggregator(
    rx: Receiver<DiffResult>,
    out_dir: &Path,
    renames_enabled: bool,
    log: &Arc<ScanLog>,
) -> Result<(Metrics, u64, u64), ScanError> {
    let commit_file = File::create(out_dir.join("tables/commit_stats.bin"))
        .map_err(|e| ScanError::ScanFailed(format!("create commit_stats.bin: {e}")))?;
    let file_file = File::create(out_dir.join("tables/file_stats.bin"))
        .map_err(|e| ScanError::ScanFailed(format!("create file_stats.bin: {e}")))?;

    let mut commit_writer = BinWriter::new(BufWriter::new(commit_file));
    let mut file_writer = BinWriter::new(BufWriter::new(file_file));

    // Rename events writer (only if renames enabled)
    let mut rename_writer = if renames_enabled {
        let rename_file = File::create(out_dir.join("tables/rename_events.bin"))
            .map_err(|e| ScanError::ScanFailed(format!("create rename_events.bin: {e}")))?;
        Some(BinWriter::new(BufWriter::new(rename_file)))
    } else {
        None
    };

    // Messages file for commit subjects
    let messages_file = File::create(out_dir.join("tables/messages.txt"))
        .map_err(|e| ScanError::ScanFailed(format!("create messages.txt: {e}")))?;
    let mut messages_writer = BufWriter::new(messages_file);

    // Dictionaries — only the aggregator assigns IDs (§6.1)
    let mut author_dict: BTreeMap<String, u32> = BTreeMap::new();
    let mut path_dict: BTreeMap<String, u32> = BTreeMap::new();
    let mut next_author_id: u32 = 0;
    let mut next_path_id: u32 = 0;

    // Reorder buffer: out-of-order results wait here
    let mut buffer: BTreeMap<u64, DiffResult> = BTreeMap::new();
    let mut next_seq: u64 = 0;

    // Aggregate counters
    let mut total_insertions: u64 = 0;
    let mut total_deletions: u64 = 0;
    let mut total_files_changed: u64 = 0;
    let mut total_binary_files: u64 = 0;
    let mut merge_commits: u64 = 0;
    let mut commit_count: u64 = 0;
    let mut file_change_count: u64 = 0;
    let mut diff_bailouts: u64 = 0;
    let mut tree_truncations: u64 = 0;

    for result in rx {
        buffer.insert(result.seq, result);

        // Process all consecutive results starting from next_seq
        while let Some(dr) = buffer.remove(&next_seq) {
            let author_id = get_or_assign_id(&mut author_dict, &mut next_author_id, &dr.author_key);
            let committer_id =
                get_or_assign_id(&mut author_dict, &mut next_author_id, &dr.committer_key);

            let mut commit_insertions: u64 = 0;
            let mut commit_deletions: u64 = 0;
            let mut commit_binary_files: u32 = 0;
            let mut commit_renames: u32 = 0;
            let mut commit_copies: u32 = 0;

            for change in &dr.changes {
                let path_id = get_or_assign_id(&mut path_dict, &mut next_path_id, &change.raw.path);
                let old_path_id = path_id; // Default; overridden for renames below

                let fs = FileStat {
                    commit_oid: dr.commit_oid,
                    parent_oid: dr.parent_oid,
                    author_id,
                    path_id,
                    change_kind: change.raw.kind as u8,
                    old_path_id,
                    old_blob_oid: change.raw.old_oid,
                    new_blob_oid: change.raw.new_oid,
                    old_mode: change.raw.old_mode,
                    new_mode: change.raw.new_mode,
                    is_binary: change.is_binary as u8,
                    insertions: change.insertions,
                    deletions: change.deletions,
                };

                file_writer
                    .write_file_stat(&fs)
                    .map_err(|e| ScanError::ScanFailed(format!("write file_stat: {e}")))?;

                if change.diff_bailed_out {
                    diff_bailouts += 1;
                }
                if !change.is_binary {
                    commit_insertions += change.insertions as u64;
                    commit_deletions += change.deletions as u64;
                } else {
                    commit_binary_files += 1;
                }

                file_change_count += 1;
            }

            // Write rename events
            for ri in &dr.rename_pairs {
                let old_pid = get_or_assign_id(&mut path_dict, &mut next_path_id, &ri.old_path);
                let new_pid = get_or_assign_id(&mut path_dict, &mut next_path_id, &ri.new_path);
                commit_renames += 1;

                if let Some(ref mut rw) = rename_writer {
                    let event = RenameEvent {
                        commit_oid: dr.commit_oid,
                        parent_oid: dr.parent_oid,
                        old_path_id: old_pid,
                        new_path_id: new_pid,
                        score: ri.score,
                        is_copy: 0,
                    };
                    rw.write_rename_event(&event)
                        .map_err(|e| ScanError::ScanFailed(format!("write rename_event: {e}")))?;
                }
            }

            // Write copy events
            for ci in &dr.copy_pairs {
                let old_pid = get_or_assign_id(&mut path_dict, &mut next_path_id, &ci.old_path);
                let new_pid = get_or_assign_id(&mut path_dict, &mut next_path_id, &ci.new_path);
                commit_copies += 1;

                if let Some(ref mut rw) = rename_writer {
                    let event = RenameEvent {
                        commit_oid: dr.commit_oid,
                        parent_oid: dr.parent_oid,
                        old_path_id: old_pid,
                        new_path_id: new_pid,
                        score: ci.score,
                        is_copy: 1,
                    };
                    rw.write_rename_event(&event)
                        .map_err(|e| ScanError::ScanFailed(format!("write copy_event: {e}")))?;
                }
            }

            total_insertions += commit_insertions;
            total_deletions += commit_deletions;
            total_files_changed += dr.changes.len() as u64;
            total_binary_files += commit_binary_files as u64;
            if dr.is_merge {
                merge_commits += 1;
            }
            if dr.tree_truncated {
                tree_truncations += 1;
            }

            let cs = CommitStat {
                commit_oid: dr.commit_oid,
                parent_oid: dr.parent_oid,
                tree_oid: dr.tree_oid,
                parent_tree_oid: dr.parent_tree_oid,
                author_id,
                committer_id,
                author_ts: dr.author_ts,
                commit_ts: dr.commit_ts,
                message_len: dr.message_len,
                parents_count: dr.parents_count,
                is_merge: dr.is_merge as u8,
                files_changed: dr.changes.len() as u32,
                insertions: commit_insertions,
                deletions: commit_deletions,
                binary_files_changed: commit_binary_files,
                renames: commit_renames,
                copies: commit_copies,
                diff_time_ns: dr.diff_time_ns,
                diff_bytes_inflated: 0,
            };

            commit_writer
                .write_commit_stat(&cs)
                .map_err(|e| ScanError::ScanFailed(format!("write commit_stat: {e}")))?;

            // Write commit message subject
            writeln!(messages_writer, "{}", dr.message_subject)
                .map_err(|e| ScanError::ScanFailed(format!("write message subject: {e}")))?;

            commit_count += 1;
            next_seq += 1;

            if commit_count.is_multiple_of(1000) {
                let rss_kb = get_rss_kb();
                log.progress(&format!(
                    "[diff] {commit_count} commits, {file_change_count} files, {} authors, {} paths, {tree_truncations} truncated, {diff_bailouts} bailouts, RSS:{rss_kb}kB",
                    author_dict.len(),
                    path_dict.len(),
                ));
            }
        }
    }

    commit_writer
        .flush()
        .map_err(|e| ScanError::ScanFailed(format!("flush commit_stats: {e}")))?;
    file_writer
        .flush()
        .map_err(|e| ScanError::ScanFailed(format!("flush file_stats: {e}")))?;
    if let Some(ref mut rw) = rename_writer {
        rw.flush()
            .map_err(|e| ScanError::ScanFailed(format!("flush rename_events: {e}")))?;
    }
    messages_writer
        .flush()
        .map_err(|e| ScanError::ScanFailed(format!("flush messages.txt: {e}")))?;

    // Build reverse dictionaries for metrics
    let authors: BTreeMap<u32, String> = author_dict.iter().map(|(k, &v)| (v, k.clone())).collect();
    let paths: BTreeMap<u32, String> = path_dict.iter().map(|(k, &v)| (v, k.clone())).collect();

    let metrics = Metrics {
        total_commits: commit_count,
        total_files_changed,
        total_insertions,
        total_deletions,
        total_authors: authors.len() as u64,
        total_paths: paths.len() as u64,
        merge_commits,
        binary_files_changed: total_binary_files,
        authors,
        paths,
        repo_metrics: None, // Filled in by pipeline after aggregation
    };

    Ok((metrics, commit_count, file_change_count))
}

fn get_rss_kb() -> u64 {
    std::fs::read_to_string("/proc/self/status")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("VmRSS:"))
                .and_then(|l| l.split_whitespace().nth(1))
                .and_then(|v| v.parse().ok())
        })
        .unwrap_or(0)
}

fn get_or_assign_id(dict: &mut BTreeMap<String, u32>, next_id: &mut u32, key: &str) -> u32 {
    if let Some(&id) = dict.get(key) {
        id
    } else {
        let id = *next_id;
        dict.insert(key.to_string(), id);
        *next_id += 1;
        id
    }
}

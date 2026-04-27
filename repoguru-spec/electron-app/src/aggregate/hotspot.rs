use std::collections::BTreeMap;

use serde::Serialize;

use crate::model::file_stat::FileStat;

/// A hot file ranked by churn.
#[derive(Debug, Serialize)]
pub struct HotFile {
    pub path_id: u32,
    pub path: String,
    pub commits: u64,
    pub total_churn: u64,
    pub distinct_authors: u64,
}

/// Compute hotspot rankings from file stats (§10).
/// Uses sort + dedup for exact distinct author counts.
pub fn compute_hotspots(file_stats: &[FileStat], paths: &BTreeMap<u32, String>) -> Vec<HotFile> {
    // Accumulate per path_id
    struct Accum {
        commits: u64,
        total_churn: u64,
    }
    let mut accums: BTreeMap<u32, Accum> = BTreeMap::new();

    // Collect (path_id, author_id) pairs for distinct author counting
    let mut path_author_pairs: Vec<(u32, u32)> = Vec::new();

    for fs in file_stats {
        let entry = accums.entry(fs.path_id).or_insert(Accum {
            commits: 0,
            total_churn: 0,
        });
        entry.commits += 1;
        // Churn = insertions + deletions (skip binary sentinel)
        if fs.insertions != 0xFFFF_FFFF {
            entry.total_churn += fs.insertions as u64 + fs.deletions as u64;
        }

        path_author_pairs.push((fs.path_id, fs.author_id));
    }

    // Sort (path_id, author_id) for distinct counting via two-pass external sort
    path_author_pairs.sort_unstable();
    path_author_pairs.dedup();

    // Count distinct authors per path
    let mut distinct_authors: BTreeMap<u32, u64> = BTreeMap::new();
    for (pid, _) in &path_author_pairs {
        *distinct_authors.entry(*pid).or_insert(0) += 1;
    }

    // Build HotFile list
    let mut hotfiles: Vec<HotFile> = accums
        .into_iter()
        .map(|(pid, acc)| {
            let path = paths.get(&pid).cloned().unwrap_or_default();
            HotFile {
                path_id: pid,
                path,
                commits: acc.commits,
                total_churn: acc.total_churn,
                distinct_authors: *distinct_authors.get(&pid).unwrap_or(&0),
            }
        })
        .collect();

    // Sort by total_churn descending
    hotfiles.sort_by(|a, b| b.total_churn.cmp(&a.total_churn));

    hotfiles
}

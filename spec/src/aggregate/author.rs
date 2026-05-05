use std::collections::BTreeMap;

use serde::Serialize;

use crate::model::commit_stat::CommitStat;

/// Per-author summary statistics.
#[derive(Debug, Serialize)]
pub struct AuthorSummary {
    pub author_id: u32,
    pub commits: u64,
    pub insertions: u64,
    pub deletions: u64,
    pub first_commit: i64,
    pub last_commit: i64,
}

/// Compute per-author summary from commit stats.
pub fn compute_author_stats(commit_stats: &[CommitStat]) -> Vec<AuthorSummary> {
    let mut summaries: BTreeMap<u32, AuthorSummary> = BTreeMap::new();

    for cs in commit_stats {
        let entry = summaries.entry(cs.author_id).or_insert(AuthorSummary {
            author_id: cs.author_id,
            commits: 0,
            insertions: 0,
            deletions: 0,
            first_commit: cs.author_ts,
            last_commit: cs.author_ts,
        });
        entry.commits += 1;
        entry.insertions += cs.insertions;
        entry.deletions += cs.deletions;
        if cs.author_ts < entry.first_commit {
            entry.first_commit = cs.author_ts;
        }
        if cs.author_ts > entry.last_commit {
            entry.last_commit = cs.author_ts;
        }
    }

    let mut result: Vec<AuthorSummary> = summaries.into_values().collect();
    // Sort by commits descending
    result.sort_by(|a, b| b.commits.cmp(&a.commits));
    result
}

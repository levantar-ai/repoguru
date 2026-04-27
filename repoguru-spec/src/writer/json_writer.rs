use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::metrics::sizer::RepoMetrics;

/// Top-level metrics written to `metrics.json`.
#[derive(Debug, Serialize, Deserialize)]
pub struct Metrics {
    pub total_commits: u64,
    pub total_files_changed: u64,
    pub total_insertions: u64,
    pub total_deletions: u64,
    pub total_authors: u64,
    pub total_paths: u64,
    pub merge_commits: u64,
    pub binary_files_changed: u64,
    /// Author dictionary: id → canonical key
    pub authors: BTreeMap<u32, String>,
    /// Path dictionary: id → path
    pub paths: BTreeMap<u32, String>,
    /// Repo-level size metrics (§7)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_metrics: Option<RepoMetrics>,
}

/// Write metrics to `metrics.json` with sorted keys for determinism.
pub fn write_metrics_json(path: &Path, metrics: &Metrics) -> anyhow::Result<()> {
    let json = serde_json::to_string_pretty(metrics)?;
    std::fs::write(path, json)?;
    Ok(())
}

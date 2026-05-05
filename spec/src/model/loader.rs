use std::path::Path;

use crate::error::ScanError;
use crate::model::commit_stat::{CommitStat, COMMIT_STAT_ROW_SIZE};
use crate::model::file_stat::{FileStat, FILE_STAT_ROW_SIZE};
use crate::writer::json_writer::Metrics;

/// Load metrics.json from a scan output directory.
pub fn load_metrics(out_path: &Path) -> Result<Metrics, ScanError> {
    let path = out_path.join("metrics.json");
    let data = std::fs::read_to_string(&path)
        .map_err(|e| ScanError::ScanFailed(format!("read metrics.json: {e}")))?;
    serde_json::from_str(&data)
        .map_err(|e| ScanError::ScanFailed(format!("parse metrics.json: {e}")))
}

/// Load commit_stats.bin from a scan output directory.
pub fn load_commit_stats(out_path: &Path) -> Result<Vec<CommitStat>, ScanError> {
    let data = std::fs::read(out_path.join("tables/commit_stats.bin"))
        .map_err(|e| ScanError::ScanFailed(format!("read commit_stats.bin: {e}")))?;
    Ok(data
        .chunks_exact(COMMIT_STAT_ROW_SIZE)
        .map(|chunk| {
            let arr: &[u8; COMMIT_STAT_ROW_SIZE] = chunk.try_into().expect("exact chunk");
            CommitStat::from_bytes(arr)
        })
        .collect())
}

/// Load file_stats.bin from a scan output directory.
pub fn load_file_stats(out_path: &Path) -> Result<Vec<FileStat>, ScanError> {
    let data = std::fs::read(out_path.join("tables/file_stats.bin"))
        .map_err(|e| ScanError::ScanFailed(format!("read file_stats.bin: {e}")))?;
    Ok(data
        .chunks_exact(FILE_STAT_ROW_SIZE)
        .map(|chunk| {
            let arr: &[u8; FILE_STAT_ROW_SIZE] = chunk.try_into().expect("exact chunk");
            FileStat::from_bytes(arr)
        })
        .collect())
}

/// Load commit message subjects from messages.txt (optional file).
pub fn load_messages(out_path: &Path) -> Vec<String> {
    let path = out_path.join("tables/messages.txt");
    match std::fs::read_to_string(&path) {
        Ok(content) => content.lines().map(|l| l.to_string()).collect(),
        Err(_) => Vec::new(),
    }
}

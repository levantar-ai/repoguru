use std::path::Path;

use crate::aggregate::author::AuthorSummary;
use crate::aggregate::hotspot::HotFile;
use crate::aggregate::timeseries::TimeBucket;
use crate::writer::json_writer::Metrics;

fn ensure_data_dir(out_dir: &Path) -> anyhow::Result<std::path::PathBuf> {
    let data_dir = out_dir.join("report/data");
    std::fs::create_dir_all(&data_dir)?;
    Ok(data_dir)
}

/// Emit summary.json for the report.
pub fn emit_summary(out_dir: &Path, metrics: &Metrics) -> anyhow::Result<()> {
    let data_dir = ensure_data_dir(out_dir)?;
    let json = serde_json::to_string_pretty(metrics)?;
    std::fs::write(data_dir.join("summary.json"), json)?;
    Ok(())
}

/// Emit timelines.json for the report.
pub fn emit_timelines(out_dir: &Path, ts: &[TimeBucket]) -> anyhow::Result<()> {
    let data_dir = ensure_data_dir(out_dir)?;
    let json = serde_json::to_string_pretty(ts)?;
    std::fs::write(data_dir.join("timelines.json"), json)?;
    Ok(())
}

/// Emit authors.json for the report.
pub fn emit_authors(out_dir: &Path, authors: &[AuthorSummary]) -> anyhow::Result<()> {
    let data_dir = ensure_data_dir(out_dir)?;
    let json = serde_json::to_string_pretty(authors)?;
    std::fs::write(data_dir.join("authors.json"), json)?;
    Ok(())
}

/// Emit hotspots.json for the report.
pub fn emit_hotspots(out_dir: &Path, hotspots: &[HotFile]) -> anyhow::Result<()> {
    let data_dir = ensure_data_dir(out_dir)?;
    let json = serde_json::to_string_pretty(hotspots)?;
    std::fs::write(data_dir.join("hotspots.json"), json)?;
    Ok(())
}

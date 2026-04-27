use thiserror::Error;

/// Domain errors for RepoAnalyze, each mapping to an exit code (§3.3).
#[derive(Debug, Error)]
pub enum ScanError {
    /// Exit code 2: invalid arguments
    #[error("invalid arguments: {0}")]
    InvalidArgs(String),

    /// Exit code 3: repo open failure
    #[error("failed to open repository: {0}")]
    RepoOpen(String),

    /// Exit code 4: scan failure (IO/object errors)
    #[error("scan failed: {0}")]
    ScanFailed(String),

    /// Exit code 5: report generation failure
    #[error("report generation failed: {0}")]
    ReportFailed(String),
}

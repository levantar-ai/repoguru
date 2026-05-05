//! Org/User bulk scanning — list repos via GitHub API, score each one.

pub mod github;
pub mod runner;

use crate::error::ScanError;
use crate::scoring::ScoreResult;

/// Progress update for an org scan.
#[derive(Debug, Clone)]
pub struct OrgScanUpdate {
    pub phase: String,
    pub repo_name: String,
    pub repos_total: u32,
    pub repos_completed: u32,
    pub repo_scores: Vec<RepoScore>,
    pub average_score: f64,
    pub average_grade: String,
    pub error: String,
}

/// Score for a single repo in an org scan.
#[derive(Debug, Clone)]
pub struct RepoScore {
    pub repo_name: String,
    pub overall_score: u32,
    pub grade: String,
    pub categories: Vec<crate::scoring::CategoryScore>,
}

/// Request parameters for an org scan.
#[derive(Debug, Clone)]
pub struct OrgScanRequest {
    pub org_or_user: String,
    pub is_user: bool,
    pub github_token: String,
    pub clone_base_dir: String,
    pub max_repos: u32,
    pub skip_forks: bool,
    pub skip_archived: bool,
}

impl From<&ScoreResult> for RepoScore {
    fn from(score: &ScoreResult) -> Self {
        RepoScore {
            repo_name: String::new(), // Set by caller
            overall_score: score.overall_score,
            grade: score.grade.clone(),
            categories: score.categories.clone(),
        }
    }
}

/// Run an org scan, sending progress updates via the provided callback.
pub fn run_org_scan(
    req: &OrgScanRequest,
    on_progress: impl Fn(OrgScanUpdate),
) -> Result<(), ScanError> {
    runner::run(req, on_progress)
}

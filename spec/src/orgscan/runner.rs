//! Org scan runner — clone repos, score them, stream progress.

use std::path::PathBuf;

use crate::error::ScanError;
use crate::scoring;

use super::github;
use super::{OrgScanRequest, OrgScanUpdate, RepoScore};

/// Run the full org scan pipeline.
pub fn run(
    req: &OrgScanRequest,
    on_progress: impl Fn(OrgScanUpdate),
) -> Result<(), ScanError> {
    // Phase 1: List repos
    on_progress(OrgScanUpdate {
        phase: "listing".into(),
        repo_name: String::new(),
        repos_total: 0,
        repos_completed: 0,
        repo_scores: Vec::new(),
        average_score: 0.0,
        average_grade: String::new(),
        error: String::new(),
    });

    let repos = github::list_repos(
        &req.org_or_user,
        req.is_user,
        &req.github_token,
        req.max_repos,
        req.skip_forks,
        req.skip_archived,
    )?;

    let total = repos.len() as u32;
    let mut completed = 0u32;
    let mut all_scores: Vec<RepoScore> = Vec::new();

    let base_dir = PathBuf::from(&req.clone_base_dir);
    std::fs::create_dir_all(&base_dir)
        .map_err(|e| ScanError::ScanFailed(format!("Failed to create clone dir: {e}")))?;

    for repo in &repos {
        // Phase 2: Clone
        on_progress(OrgScanUpdate {
            phase: "cloning".into(),
            repo_name: repo.full_name.clone(),
            repos_total: total,
            repos_completed: completed,
            repo_scores: all_scores.clone(),
            average_score: compute_average(&all_scores),
            average_grade: String::new(),
            error: String::new(),
        });

        let repo_dir = base_dir.join(repo.full_name.replace('/', "_"));
        if let Err(e) = clone_via_gix(&repo.clone_url, &repo_dir) {
            completed += 1;
            on_progress(OrgScanUpdate {
                phase: "scanning".into(),
                repo_name: repo.full_name.clone(),
                repos_total: total,
                repos_completed: completed,
                repo_scores: all_scores.clone(),
                average_score: compute_average(&all_scores),
                average_grade: String::new(),
                error: format!("Clone failed for {}: {e}", repo.full_name),
            });
            continue;
        }

        // Phase 3: Score
        on_progress(OrgScanUpdate {
            phase: "scoring".into(),
            repo_name: repo.full_name.clone(),
            repos_total: total,
            repos_completed: completed,
            repo_scores: all_scores.clone(),
            average_score: compute_average(&all_scores),
            average_grade: String::new(),
            error: String::new(),
        });

        match scoring::score_repo(&repo_dir, None) {
            Ok(score) => {
                let mut repo_score = RepoScore::from(&score);
                repo_score.repo_name = repo.full_name.clone();
                all_scores.push(repo_score);
            }
            Err(e) => {
                on_progress(OrgScanUpdate {
                    phase: "scoring".into(),
                    repo_name: repo.full_name.clone(),
                    repos_total: total,
                    repos_completed: completed + 1,
                    repo_scores: all_scores.clone(),
                    average_score: compute_average(&all_scores),
                    average_grade: String::new(),
                    error: format!("Scoring failed for {}: {e}", repo.full_name),
                });
            }
        }

        completed += 1;
    }

    // Phase 4: Done
    let avg = compute_average(&all_scores);
    let avg_grade = crate::scoring::categories::grade_for_score(avg.round() as u32);

    on_progress(OrgScanUpdate {
        phase: "done".into(),
        repo_name: String::new(),
        repos_total: total,
        repos_completed: completed,
        repo_scores: all_scores,
        average_score: avg,
        average_grade: avg_grade,
        error: String::new(),
    });

    Ok(())
}

fn compute_average(scores: &[RepoScore]) -> f64 {
    if scores.is_empty() {
        return 0.0;
    }
    let sum: u32 = scores.iter().map(|s| s.overall_score).sum();
    sum as f64 / scores.len() as f64
}

/// Clone a repo using gix (no external git binary).
/// If the directory already exists and is a valid repo, skip cloning.
fn clone_via_gix(url: &str, dest: &PathBuf) -> Result<(), ScanError> {
    // If already cloned and valid, skip
    if dest.exists() {
        if gix::open(dest).is_ok() {
            return Ok(());
        }
        // Invalid repo dir — remove and re-clone
        std::fs::remove_dir_all(dest)
            .map_err(|e| ScanError::ScanFailed(format!("Failed to clean {}: {e}", dest.display())))?;
    }

    // Use gix to clone
    let url = gix::url::parse(url.into())
        .map_err(|e| ScanError::ScanFailed(format!("Invalid clone URL {url}: {e}")))?;

    let mut prepare = gix::prepare_clone_bare(url, dest)
        .map_err(|e| ScanError::ScanFailed(format!("Clone prepare failed: {e}")))?;

    let (_repo, _outcome) = prepare
        .fetch_only(gix::progress::Discard, &std::sync::atomic::AtomicBool::new(false))
        .map_err(|e| ScanError::ScanFailed(format!("Clone fetch failed: {e}")))?;

    Ok(())
}

//! Repo comparison — score two repos and compute per-category deltas.

use std::path::Path;

use crate::error::ScanError;
use crate::scoring::{self, ScoreResult};

/// Per-category delta between two repos.
#[derive(Debug, Clone)]
pub struct ComparisonDelta {
    pub category: String,
    pub score_a: i32,
    pub score_b: i32,
    pub delta: i32,
    pub winner: String,
}

/// Full comparison result.
#[derive(Debug, Clone)]
pub struct CompareResult {
    pub report_card_a: ScoreResult,
    pub report_card_b: ScoreResult,
    pub deltas: Vec<ComparisonDelta>,
    pub winner: String,
    pub score_delta: i32,
}

/// Compare two repositories side-by-side.
pub fn compare(
    repo_path_a: &Path,
    repo_path_b: &Path,
    out_path_a: Option<&Path>,
    out_path_b: Option<&Path>,
) -> Result<CompareResult, ScanError> {
    let score_a = scoring::score_repo(repo_path_a, out_path_a)?;
    let score_b = scoring::score_repo(repo_path_b, out_path_b)?;

    let mut deltas = Vec::new();
    for cat_a in &score_a.categories {
        let score_b_val = score_b
            .categories
            .iter()
            .find(|c| c.key == cat_a.key)
            .map(|c| c.score as i32)
            .unwrap_or(0);
        let sa = cat_a.score as i32;
        let delta = sa - score_b_val;
        let winner = match delta.cmp(&0) {
            std::cmp::Ordering::Greater => "a",
            std::cmp::Ordering::Less => "b",
            std::cmp::Ordering::Equal => "tie",
        };
        deltas.push(ComparisonDelta {
            category: cat_a.key.clone(),
            score_a: sa,
            score_b: score_b_val,
            delta,
            winner: winner.to_string(),
        });
    }

    let overall_delta = score_a.overall_score as i32 - score_b.overall_score as i32;
    let winner = match overall_delta.cmp(&0) {
        std::cmp::Ordering::Greater => "a",
        std::cmp::Ordering::Less => "b",
        std::cmp::Ordering::Equal => "tie",
    };

    Ok(CompareResult {
        report_card_a: score_a,
        report_card_b: score_b,
        deltas,
        winner: winner.to_string(),
        score_delta: overall_delta,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compare_repo_with_itself() {
        let repo = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let result = compare(&repo, &repo, None, None).expect("compare should succeed");

        // Comparing a repo with itself should yield tie on all categories
        assert_eq!(result.winner, "tie");
        assert_eq!(result.score_delta, 0);
        for delta in &result.deltas {
            assert_eq!(delta.delta, 0);
            assert_eq!(delta.winner, "tie");
        }
        assert_eq!(result.report_card_a.overall_score, result.report_card_b.overall_score);
    }
}

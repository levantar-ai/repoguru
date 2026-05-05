//! Report card scoring engine — scores a repository across 8 weighted categories.
//!
//! Operates on the HEAD tree (file presence checks) and optionally enriches
//! with scan output data (git history metrics).

pub mod categories;
pub mod cicd;
pub mod code_quality;
pub mod community;
pub mod dependencies;
pub mod documentation;
pub mod license;
pub mod openssf;
pub mod security;
pub mod tree_reader;

use std::collections::BTreeMap;
use std::path::Path;

use crate::error::ScanError;
use categories::{CategoryDef, CATEGORIES, grade_for_score};
use tree_reader::TreeContext;

/// A single detected signal within a category.
#[derive(Debug, Clone, serde::Serialize)]
pub struct Signal {
    pub name: String,
    pub found: bool,
    pub details: String,
    pub points: u32,
}

/// Score for a single category.
#[derive(Debug, Clone, serde::Serialize)]
pub struct CategoryScore {
    pub key: String,
    pub label: String,
    pub score: u32,
    pub grade: String,
    pub weight: f64,
    pub signals: Vec<Signal>,
}

/// Complete report card result.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ScoreResult {
    pub overall_score: u32,
    pub grade: String,
    pub categories: Vec<CategoryScore>,
    pub strengths: Vec<String>,
    pub risks: Vec<String>,
    pub next_steps: Vec<String>,
    pub scored_at: String,
}

/// Type alias for category analyzer functions.
type CategoryAnalyzer = fn(&TreeContext) -> Vec<Signal>;

/// Score a repository, returning a full report card.
pub fn score_repo(
    repo_path: &Path,
    scan_out: Option<&Path>,
) -> Result<ScoreResult, ScanError> {
    let ctx = TreeContext::from_repo(repo_path, scan_out)?;

    let analyzers: BTreeMap<&str, CategoryAnalyzer> = BTreeMap::from([
        ("documentation", documentation::analyze as CategoryAnalyzer),
        ("security", security::analyze as CategoryAnalyzer),
        ("cicd", cicd::analyze as CategoryAnalyzer),
        ("dependencies", dependencies::analyze as CategoryAnalyzer),
        ("code_quality", code_quality::analyze as CategoryAnalyzer),
        ("license", license::analyze as CategoryAnalyzer),
        ("community", community::analyze as CategoryAnalyzer),
        ("openssf", openssf::analyze as CategoryAnalyzer),
    ]);

    let mut categories = Vec::new();
    let mut weighted_sum: f64 = 0.0;

    for cat_def in CATEGORIES.iter() {
        let analyzer = analyzers
            .get(cat_def.key)
            .expect("missing analyzer for category");
        let signals = analyzer(&ctx);
        let score = compute_category_score(&signals, cat_def);
        let grade = grade_for_score(score);

        weighted_sum += score as f64 * cat_def.weight;

        categories.push(CategoryScore {
            key: cat_def.key.to_string(),
            label: cat_def.label.to_string(),
            score,
            grade,
            weight: cat_def.weight,
            signals,
        });
    }

    let overall_score = weighted_sum.round() as u32;
    let grade = grade_for_score(overall_score);

    let strengths = derive_strengths(&categories);
    let risks = derive_risks(&categories);
    let next_steps = derive_next_steps(&categories);

    let scored_at = chrono_now_iso8601();

    Ok(ScoreResult {
        overall_score,
        grade,
        categories,
        strengths,
        risks,
        next_steps,
        scored_at,
    })
}

/// Compute a category score (0-100) from its signals.
fn compute_category_score(signals: &[Signal], _cat: &CategoryDef) -> u32 {
    let max_points: u32 = signals.iter().map(|s| s.points).sum();
    if max_points == 0 {
        return 0;
    }
    let earned: u32 = signals
        .iter()
        .filter(|s| s.found)
        .map(|s| s.points)
        .sum();
    // Normalize to 0-100
    ((earned as f64 / max_points as f64) * 100.0).round() as u32
}

/// Derive strengths from high-scoring categories.
fn derive_strengths(categories: &[CategoryScore]) -> Vec<String> {
    categories
        .iter()
        .filter(|c| c.score >= 70)
        .map(|c| format!("Strong {} ({})", c.label, c.grade))
        .collect()
}

/// Derive risks from low-scoring categories.
fn derive_risks(categories: &[CategoryScore]) -> Vec<String> {
    categories
        .iter()
        .filter(|c| c.score < 40)
        .map(|c| format!("{} needs attention ({})", c.label, c.grade))
        .collect()
}

/// Derive actionable next steps from missing signals.
fn derive_next_steps(categories: &[CategoryScore]) -> Vec<String> {
    let mut steps = Vec::new();
    for cat in categories {
        if cat.score >= 85 {
            continue;
        }
        // Find the highest-point missing signal as the best next step
        if let Some(best) = cat
            .signals
            .iter()
            .filter(|s| !s.found)
            .max_by_key(|s| s.points)
        {
            steps.push(format!("Add {} (+{} pts to {})", best.name, best.points, cat.label));
        }
        if steps.len() >= 5 {
            break;
        }
    }
    steps
}

/// ISO 8601 timestamp without pulling in chrono crate.
pub fn chrono_now_iso8601() -> String {
    // Use std::time for a basic timestamp
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = now.as_secs();
    // Simple UTC format: we'll just provide epoch seconds if we can't format nicely
    // Better: do manual UTC formatting
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Calculate year/month/day from days since epoch (1970-01-01)
    let (year, month, day) = days_to_ymd(days_since_epoch);

    format!(
        "{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}Z"
    )
}

fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    // Civil calendar from days since epoch
    let mut year = 1970u64;
    loop {
        let days_in_year = if is_leap(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }
    let leap = is_leap(year);
    let month_days: [u64; 12] = [
        31,
        if leap { 29 } else { 28 },
        31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1u64;
    for &md in &month_days {
        if days < md {
            break;
        }
        days -= md;
        month += 1;
    }
    (year, month, days + 1)
}

fn is_leap(y: u64) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_category_score() {
        let signals = vec![
            Signal { name: "A".into(), found: true, details: String::new(), points: 25 },
            Signal { name: "B".into(), found: false, details: String::new(), points: 25 },
            Signal { name: "C".into(), found: true, details: String::new(), points: 50 },
        ];
        let cat = CategoryDef { key: "test", label: "Test", weight: 0.15 };
        assert_eq!(compute_category_score(&signals, &cat), 75);
    }

    #[test]
    fn test_grade_thresholds() {
        assert_eq!(grade_for_score(100), "A");
        assert_eq!(grade_for_score(85), "A");
        assert_eq!(grade_for_score(84), "B");
        assert_eq!(grade_for_score(70), "B");
        assert_eq!(grade_for_score(55), "C");
        assert_eq!(grade_for_score(40), "D");
        assert_eq!(grade_for_score(39), "F");
        assert_eq!(grade_for_score(0), "F");
    }

    #[test]
    fn test_iso8601_format() {
        let ts = chrono_now_iso8601();
        assert!(ts.ends_with('Z'));
        assert!(ts.contains('T'));
        assert_eq!(ts.len(), 20); // "2026-03-18T09:24:12Z"
    }
}

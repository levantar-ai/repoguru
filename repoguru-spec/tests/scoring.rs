//! Integration tests for the scoring engine.

use std::path::PathBuf;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

#[test]
fn score_self_repo() {
    // Score the repoanalyze repo itself
    let result = repoanalyze::scoring::score_repo(&repo_root(), None)
        .expect("scoring should succeed on self repo");

    // Check overall structure
    assert!(result.overall_score <= 100);
    assert!(!result.grade.is_empty());
    assert_eq!(result.categories.len(), 8);
    assert!(!result.scored_at.is_empty());

    // Check each category has valid data
    for cat in &result.categories {
        assert!(cat.score <= 100, "{} score {} > 100", cat.key, cat.score);
        assert!(!cat.grade.is_empty());
        assert!(cat.weight > 0.0 && cat.weight <= 1.0);
        assert!(!cat.signals.is_empty(), "{} has no signals", cat.key);
    }

    // This repo should have at least a README and Cargo.toml
    let doc = result.categories.iter().find(|c| c.key == "documentation").unwrap();
    let readme_signal = doc.signals.iter().find(|s| s.name == "README exists");
    // We may not have a README.md at root, but we should have the signal defined
    assert!(readme_signal.is_some());

    let deps = result.categories.iter().find(|c| c.key == "dependencies").unwrap();
    let manifest_signal = deps.signals.iter().find(|s| s.name == "Dependency manifest").unwrap();
    assert!(manifest_signal.found, "Cargo.toml should be detected as dependency manifest");

    // Verify weights sum to 1.0
    let total_weight: f64 = result.categories.iter().map(|c| c.weight).sum();
    assert!((total_weight - 1.0).abs() < 1e-9);
}

#[test]
fn grade_boundaries() {
    use repoanalyze::scoring::categories::grade_for_score;
    assert_eq!(grade_for_score(100), "A");
    assert_eq!(grade_for_score(85), "A");
    assert_eq!(grade_for_score(84), "B");
    assert_eq!(grade_for_score(70), "B");
    assert_eq!(grade_for_score(69), "C");
    assert_eq!(grade_for_score(55), "C");
    assert_eq!(grade_for_score(54), "D");
    assert_eq!(grade_for_score(40), "D");
    assert_eq!(grade_for_score(39), "F");
    assert_eq!(grade_for_score(0), "F");
}

//! Category definitions: weights, grade thresholds.

/// Definition of a scoring category.
pub struct CategoryDef {
    pub key: &'static str,
    pub label: &'static str,
    pub weight: f64,
}

/// The 8 scoring categories with their weights (must sum to 1.0).
pub static CATEGORIES: &[CategoryDef] = &[
    CategoryDef { key: "documentation", label: "Documentation", weight: 0.15 },
    CategoryDef { key: "security", label: "Security", weight: 0.10 },
    CategoryDef { key: "cicd", label: "CI/CD", weight: 0.15 },
    CategoryDef { key: "dependencies", label: "Dependencies", weight: 0.15 },
    CategoryDef { key: "code_quality", label: "Code Quality", weight: 0.15 },
    CategoryDef { key: "license", label: "License", weight: 0.10 },
    CategoryDef { key: "community", label: "Community", weight: 0.10 },
    CategoryDef { key: "openssf", label: "OpenSSF", weight: 0.10 },
];

/// Convert a numeric score (0-100) to a letter grade.
pub fn grade_for_score(score: u32) -> String {
    match score {
        85..=100 => "A".to_string(),
        70..=84 => "B".to_string(),
        55..=69 => "C".to_string(),
        40..=54 => "D".to_string(),
        _ => "F".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weights_sum_to_one() {
        let total: f64 = CATEGORIES.iter().map(|c| c.weight).sum();
        assert!((total - 1.0).abs() < 1e-9, "weights sum to {total}, expected 1.0");
    }

    #[test]
    fn all_categories_present() {
        assert_eq!(CATEGORIES.len(), 8);
    }
}

//! Export formats — CSV, Markdown, SVG badge generation.

pub mod badge;
pub mod csv;
pub mod markdown;

use crate::scoring::ScoreResult;

/// Export result.
#[derive(Debug, Clone)]
pub struct ExportResult {
    pub format: String,
    pub content: String,
    pub content_type: String,
}

/// Export a report card in the specified format.
pub fn export(format: &str, score: &ScoreResult, repo_name: &str, badge_style: &str, badge_label: &str) -> Result<ExportResult, String> {
    match format {
        "csv" => Ok(ExportResult {
            format: "csv".into(),
            content: csv::export_csv(score),
            content_type: "text/csv".into(),
        }),
        "markdown" => Ok(ExportResult {
            format: "markdown".into(),
            content: markdown::export_markdown(score, repo_name),
            content_type: "text/markdown".into(),
        }),
        "badge-svg" => Ok(ExportResult {
            format: "badge-svg".into(),
            content: badge::export_badge(score, badge_style, badge_label),
            content_type: "image/svg+xml".into(),
        }),
        "json" => {
            let json = serde_json::to_string_pretty(score)
                .map_err(|e| format!("JSON serialization failed: {e}"))?;
            Ok(ExportResult {
                format: "json".into(),
                content: json,
                content_type: "application/json".into(),
            })
        }
        _ => Err(format!("unsupported export format: {format}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scoring::{CategoryScore, Signal};

    fn mock_score() -> ScoreResult {
        ScoreResult {
            overall_score: 75,
            grade: "B".into(),
            categories: vec![
                CategoryScore {
                    key: "documentation".into(),
                    label: "Documentation".into(),
                    score: 80,
                    grade: "B".into(),
                    weight: 0.15,
                    signals: vec![
                        Signal { name: "README exists".into(), found: true, details: "README.md".into(), points: 25 },
                        Signal { name: "CHANGELOG".into(), found: false, details: String::new(), points: 10 },
                    ],
                },
                CategoryScore {
                    key: "security".into(),
                    label: "Security".into(),
                    score: 60,
                    grade: "C".into(),
                    weight: 0.10,
                    signals: vec![
                        Signal { name: "SECURITY.md".into(), found: true, details: String::new(), points: 20 },
                    ],
                },
            ],
            strengths: vec!["Strong Documentation (B)".into()],
            risks: vec![],
            next_steps: vec!["Add CHANGELOG (+10 pts to Documentation)".into()],
            scored_at: "2026-03-18T00:00:00Z".into(),
        }
    }

    #[test]
    fn test_csv_export() {
        let result = export("csv", &mock_score(), "test/repo", "", "").unwrap();
        assert_eq!(result.content_type, "text/csv");
        assert!(result.content.contains("documentation"));
        assert!(result.content.contains("80"));
    }

    #[test]
    fn test_markdown_export() {
        let result = export("markdown", &mock_score(), "test/repo", "", "").unwrap();
        assert_eq!(result.content_type, "text/markdown");
        assert!(result.content.contains("test/repo"));
        assert!(result.content.contains("Documentation"));
    }

    #[test]
    fn test_badge_export() {
        let result = export("badge-svg", &mock_score(), "test/repo", "flat", "repo health").unwrap();
        assert_eq!(result.content_type, "image/svg+xml");
        assert!(result.content.contains("<svg"));
        assert!(result.content.contains("75"));
    }

    #[test]
    fn test_json_export() {
        let result = export("json", &mock_score(), "test/repo", "", "").unwrap();
        assert_eq!(result.content_type, "application/json");
        let parsed: serde_json::Value = serde_json::from_str(&result.content).unwrap();
        assert_eq!(parsed["overall_score"], 75);
    }

    #[test]
    fn test_unknown_format() {
        let result = export("xml", &mock_score(), "test/repo", "", "");
        assert!(result.is_err());
    }
}

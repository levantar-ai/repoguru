//! Policy engine — evaluate compliance rules against a scored report card.
//!
//! Supports 3 rule types: category-score, overall-score, signal-based.
//! 3 built-in presets: basic-hygiene, production-ready, security-focused.

pub mod presets;
pub mod rules;

use crate::scoring::ScoreResult;

/// A policy set containing rules to evaluate.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PolicySet {
    pub id: String,
    pub name: String,
    pub description: String,
    pub rules: Vec<PolicyRule>,
}

/// A single policy rule.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PolicyRule {
    pub id: String,
    pub name: String,
    pub description: String,
    /// "overall-score", "category-score", or "signal"
    pub rule_type: String,
    /// ">=", ">", "<=", "<", "==", "exists", "not-exists"
    pub operator: String,
    /// Threshold for score rules
    pub value: f64,
    /// Category key for "category-score" type
    pub category: String,
    /// Signal name for "signal" type
    pub signal: String,
    /// "error", "warning", "info"
    pub severity: String,
}

/// Result of evaluating a single rule.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PolicyRuleResult {
    pub rule: PolicyRule,
    pub passed: bool,
    pub actual: String,
    pub expected: String,
}

/// Result of evaluating a full policy set.
#[derive(Debug, Clone, serde::Serialize)]
pub struct PolicyEvaluation {
    pub passed: bool,
    pub pass_count: u32,
    pub fail_count: u32,
    pub results: Vec<PolicyRuleResult>,
    pub evaluated_at: String,
}

/// Evaluate a policy set against a scored report card.
pub fn evaluate(policy: &PolicySet, score: &ScoreResult) -> PolicyEvaluation {
    let results: Vec<PolicyRuleResult> = policy
        .rules
        .iter()
        .map(|rule| rules::evaluate_rule(rule, score))
        .collect();

    let pass_count = results.iter().filter(|r| r.passed).count() as u32;
    let fail_count = results.iter().filter(|r| !r.passed).count() as u32;

    // Policy passes if no "error" severity rules failed
    let passed = !results
        .iter()
        .any(|r| !r.passed && r.rule.severity == "error");

    PolicyEvaluation {
        passed,
        pass_count,
        fail_count,
        results,
        evaluated_at: crate::scoring::chrono_now_iso8601(),
    }
}

/// Evaluate a preset policy by name.
pub fn evaluate_preset(preset_name: &str, score: &ScoreResult) -> Result<PolicyEvaluation, String> {
    let policy = presets::get_preset(preset_name)
        .ok_or_else(|| format!("unknown preset: {preset_name}"))?;
    Ok(evaluate(&policy, score))
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
                        Signal { name: "README exists".into(), found: true, details: String::new(), points: 25 },
                        Signal { name: "CHANGELOG".into(), found: false, details: String::new(), points: 10 },
                    ],
                },
                CategoryScore {
                    key: "security".into(),
                    label: "Security".into(),
                    score: 40,
                    grade: "D".into(),
                    weight: 0.10,
                    signals: vec![
                        Signal { name: "SECURITY.md".into(), found: false, details: String::new(), points: 20 },
                    ],
                },
            ],
            strengths: vec![],
            risks: vec![],
            next_steps: vec![],
            scored_at: "2026-03-18T00:00:00Z".into(),
        }
    }

    #[test]
    fn test_overall_score_rule_pass() {
        let policy = PolicySet {
            id: "test".into(),
            name: "Test".into(),
            description: "Test policy".into(),
            rules: vec![PolicyRule {
                id: "r1".into(),
                name: "Overall >= 70".into(),
                description: "Overall score must be at least 70".into(),
                rule_type: "overall-score".into(),
                operator: ">=".into(),
                value: 70.0,
                category: String::new(),
                signal: String::new(),
                severity: "error".into(),
            }],
        };
        let result = evaluate(&policy, &mock_score());
        assert!(result.passed);
        assert_eq!(result.pass_count, 1);
    }

    #[test]
    fn test_category_score_rule_fail() {
        let policy = PolicySet {
            id: "test".into(),
            name: "Test".into(),
            description: "Test policy".into(),
            rules: vec![PolicyRule {
                id: "r1".into(),
                name: "Security >= 60".into(),
                description: "Security must be at least 60".into(),
                rule_type: "category-score".into(),
                operator: ">=".into(),
                value: 60.0,
                category: "security".into(),
                signal: String::new(),
                severity: "error".into(),
            }],
        };
        let result = evaluate(&policy, &mock_score());
        assert!(!result.passed);
        assert_eq!(result.fail_count, 1);
    }

    #[test]
    fn test_signal_exists_rule() {
        let policy = PolicySet {
            id: "test".into(),
            name: "Test".into(),
            description: "Test policy".into(),
            rules: vec![
                PolicyRule {
                    id: "r1".into(),
                    name: "README exists".into(),
                    description: "Must have README".into(),
                    rule_type: "signal".into(),
                    operator: "exists".into(),
                    value: 0.0,
                    category: String::new(),
                    signal: "README exists".into(),
                    severity: "error".into(),
                },
                PolicyRule {
                    id: "r2".into(),
                    name: "No SECURITY.md".into(),
                    description: "Should have SECURITY.md".into(),
                    rule_type: "signal".into(),
                    operator: "exists".into(),
                    value: 0.0,
                    category: String::new(),
                    signal: "SECURITY.md".into(),
                    severity: "warning".into(),
                },
            ],
        };
        let result = evaluate(&policy, &mock_score());
        // passes because SECURITY.md failure is only "warning", not "error"
        assert!(result.passed);
        assert_eq!(result.pass_count, 1);
        assert_eq!(result.fail_count, 1);
    }

    #[test]
    fn test_presets_exist() {
        for name in &["basic-hygiene", "production-ready", "security-focused"] {
            let preset = presets::get_preset(name);
            assert!(preset.is_some(), "preset {name} should exist");
            assert!(!preset.unwrap().rules.is_empty());
        }
    }
}

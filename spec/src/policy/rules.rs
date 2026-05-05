//! Rule evaluation logic.

use crate::scoring::ScoreResult;
use super::{PolicyRule, PolicyRuleResult};

/// Evaluate a single rule against a scored report card.
pub fn evaluate_rule(rule: &PolicyRule, score: &ScoreResult) -> PolicyRuleResult {
    match rule.rule_type.as_str() {
        "overall-score" => eval_overall_score(rule, score),
        "category-score" => eval_category_score(rule, score),
        "signal" => eval_signal(rule, score),
        _ => PolicyRuleResult {
            rule: rule.clone(),
            passed: false,
            actual: "unknown rule type".into(),
            expected: format!("{} {} {}", rule.rule_type, rule.operator, rule.value),
        },
    }
}

fn eval_overall_score(rule: &PolicyRule, score: &ScoreResult) -> PolicyRuleResult {
    let actual_val = score.overall_score as f64;
    let passed = compare(actual_val, &rule.operator, rule.value);
    PolicyRuleResult {
        rule: rule.clone(),
        passed,
        actual: format!("Overall score: {}", score.overall_score),
        expected: format!("{} {}", rule.operator, rule.value),
    }
}

fn eval_category_score(rule: &PolicyRule, score: &ScoreResult) -> PolicyRuleResult {
    let cat = score.categories.iter().find(|c| c.key == rule.category);
    match cat {
        Some(c) => {
            let passed = compare(c.score as f64, &rule.operator, rule.value);
            PolicyRuleResult {
                rule: rule.clone(),
                passed,
                actual: format!("{} score: {}", c.label, c.score),
                expected: format!("{} {}", rule.operator, rule.value),
            }
        }
        None => PolicyRuleResult {
            rule: rule.clone(),
            passed: false,
            actual: format!("Category '{}' not found", rule.category),
            expected: format!("{} {}", rule.operator, rule.value),
        },
    }
}

fn eval_signal(rule: &PolicyRule, score: &ScoreResult) -> PolicyRuleResult {
    // Search all categories for the signal
    let signal = score.categories.iter().flat_map(|c| &c.signals).find(|s| s.name == rule.signal);

    match (&rule.operator as &str, signal) {
        ("exists", Some(s)) => PolicyRuleResult {
            rule: rule.clone(),
            passed: s.found,
            actual: if s.found { format!("{}: found", s.name) } else { format!("{}: not found", s.name) },
            expected: "exists".into(),
        },
        ("exists", None) => PolicyRuleResult {
            rule: rule.clone(),
            passed: false,
            actual: format!("Signal '{}' not in report card", rule.signal),
            expected: "exists".into(),
        },
        ("not-exists", Some(s)) => PolicyRuleResult {
            rule: rule.clone(),
            passed: !s.found,
            actual: if s.found { format!("{}: found", s.name) } else { format!("{}: not found", s.name) },
            expected: "not-exists".into(),
        },
        ("not-exists", None) => PolicyRuleResult {
            rule: rule.clone(),
            passed: true,
            actual: format!("Signal '{}' not in report card", rule.signal),
            expected: "not-exists".into(),
        },
        _ => PolicyRuleResult {
            rule: rule.clone(),
            passed: false,
            actual: format!("Invalid operator '{}' for signal rule", rule.operator),
            expected: format!("{}", rule.operator),
        },
    }
}

fn compare(actual: f64, operator: &str, threshold: f64) -> bool {
    match operator {
        ">=" => actual >= threshold,
        ">" => actual > threshold,
        "<=" => actual <= threshold,
        "<" => actual < threshold,
        "==" => (actual - threshold).abs() < f64::EPSILON,
        _ => false,
    }
}

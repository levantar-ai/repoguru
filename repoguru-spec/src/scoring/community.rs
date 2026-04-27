//! Community category analyzer (weight: 0.10).

use super::tree_reader::TreeContext;
use super::Signal;

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    // Issue templates (20 pts)
    let has_issue_templates = ctx.has_path_matching(|p| p.starts_with(".github/ISSUE_TEMPLATE/"));
    signals.push(Signal {
        name: "Issue templates".into(),
        found: has_issue_templates,
        details: String::new(),
        points: 20,
    });

    // PR template (20 pts)
    let has_pr_template = ctx.has_path(".github/PULL_REQUEST_TEMPLATE.md")
        || ctx.has_path(".github/pull_request_template.md")
        || ctx.has_path_matching(|p| p.starts_with(".github/PULL_REQUEST_TEMPLATE/"));
    signals.push(Signal {
        name: "PR template".into(),
        found: has_pr_template,
        details: String::new(),
        points: 20,
    });

    // Code of Conduct (20 pts)
    let has_coc = ctx.has_file_ci("CODE_OF_CONDUCT.md")
        || ctx.has_path(".github/CODE_OF_CONDUCT.md");
    signals.push(Signal {
        name: "Code of Conduct".into(),
        found: has_coc,
        details: String::new(),
        points: 20,
    });

    // CONTRIBUTING.md (20 pts)
    let has_contributing = ctx.has_file_ci("CONTRIBUTING.md");
    signals.push(Signal {
        name: "CONTRIBUTING.md".into(),
        found: has_contributing,
        details: String::new(),
        points: 20,
    });

    // Funding configuration (10 pts)
    let has_funding = ctx.has_path(".github/FUNDING.yml")
        || ctx.has_path(".github/FUNDING.yaml");
    signals.push(Signal {
        name: "Funding configuration".into(),
        found: has_funding,
        details: String::new(),
        points: 10,
    });

    // SUPPORT.md (10 pts)
    let has_support = ctx.has_file_ci("SUPPORT.md")
        || ctx.has_path(".github/SUPPORT.md");
    signals.push(Signal {
        name: "SUPPORT.md".into(),
        found: has_support,
        details: String::new(),
        points: 10,
    });

    signals
}

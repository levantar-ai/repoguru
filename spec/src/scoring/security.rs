//! Security category analyzer (weight: 0.10).

use super::tree_reader::TreeContext;
use super::Signal;

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    // SECURITY.md (20 pts)
    signals.push(Signal {
        name: "SECURITY.md".into(),
        found: ctx.has_file_ci("SECURITY.md") || ctx.has_path(".github/SECURITY.md"),
        details: String::new(),
        points: 20,
    });

    // CODEOWNERS (15 pts)
    signals.push(Signal {
        name: "CODEOWNERS".into(),
        found: ctx.has_path("CODEOWNERS")
            || ctx.has_path(".github/CODEOWNERS")
            || ctx.has_path("docs/CODEOWNERS"),
        details: String::new(),
        points: 15,
    });

    // Dependabot configured (20 pts)
    let has_dependabot = ctx.has_path(".github/dependabot.yml")
        || ctx.has_path(".github/dependabot.yaml");
    signals.push(Signal {
        name: "Dependabot configured".into(),
        found: has_dependabot,
        details: String::new(),
        points: 20,
    });

    // CodeQL / security scanning (15 pts)
    let has_codeql = ctx.paths_matching(|p| {
        p.starts_with(".github/workflows/") && (p.ends_with(".yml") || p.ends_with(".yaml"))
    }).iter().any(|p| {
        ctx.file_content(p)
            .map(|c| c.contains("codeql") || c.contains("CodeQL") || c.contains("security-analysis"))
            .unwrap_or(false)
    });
    signals.push(Signal {
        name: "CodeQL / security scanning".into(),
        found: has_codeql,
        details: String::new(),
        points: 15,
    });

    // PR-triggered workflows (10 pts)
    let has_pr_workflow = workflow_content_contains(ctx, "pull_request");
    signals.push(Signal {
        name: "PR-triggered workflows".into(),
        found: has_pr_workflow,
        details: String::new(),
        points: 10,
    });

    // .gitignore present (10 pts)
    signals.push(Signal {
        name: ".gitignore present".into(),
        found: ctx.has_path(".gitignore"),
        details: String::new(),
        points: 10,
    });

    // No exposed secret files (10 pts)
    let has_secrets = ctx.has_path_matching(|p| {
        let basename = p.rsplit('/').next().unwrap_or(p);
        basename == ".env"
            || basename.starts_with("credentials")
            || basename.starts_with("secret")
            || basename == ".env.local"
            || basename == ".env.production"
    });
    signals.push(Signal {
        name: "No exposed secret files".into(),
        found: !has_secrets,
        details: if has_secrets {
            "Secret files found in tree".into()
        } else {
            String::new()
        },
        points: 10,
    });

    signals
}

fn workflow_content_contains(ctx: &TreeContext, needle: &str) -> bool {
    ctx.paths_matching(|p| {
        p.starts_with(".github/workflows/") && (p.ends_with(".yml") || p.ends_with(".yaml"))
    })
    .iter()
    .any(|p| {
        ctx.file_content(p)
            .map(|c| c.contains(needle))
            .unwrap_or(false)
    })
}

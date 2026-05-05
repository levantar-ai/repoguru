//! CI/CD category analyzer (weight: 0.15).

use super::tree_reader::TreeContext;
use super::Signal;

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    // GitHub Actions workflows (25 pts)
    let workflow_paths = ctx.paths_matching(|p| {
        p.starts_with(".github/workflows/") && (p.ends_with(".yml") || p.ends_with(".yaml"))
    });
    let has_workflows = !workflow_paths.is_empty();
    signals.push(Signal {
        name: "GitHub Actions workflows".into(),
        found: has_workflows,
        details: if has_workflows {
            format!("{} workflow(s)", workflow_paths.len())
        } else {
            String::new()
        },
        points: 25,
    });

    // CI workflow (test/build) (25 pts)
    let has_ci = workflow_paths.iter().any(|p| {
        let content = ctx.file_content(p).unwrap_or("");
        let has_trigger = content.contains("push") || content.contains("pull_request");
        let has_ci_step = content.contains("test")
            || content.contains("build")
            || content.contains("ci")
            || content.contains("check");
        has_trigger && has_ci_step
    });
    signals.push(Signal {
        name: "CI workflow (test/build)".into(),
        found: has_ci,
        details: String::new(),
        points: 25,
    });

    // Deploy / release workflow (15 pts)
    let has_deploy = workflow_paths.iter().any(|p| {
        let basename = p.rsplit('/').next().unwrap_or(p).to_lowercase();
        let content = ctx.file_content(p).unwrap_or("").to_lowercase();
        basename.contains("deploy")
            || basename.contains("release")
            || basename.contains("publish")
            || content.contains("deploy")
            || content.contains("release")
            || content.contains("publish")
    });
    signals.push(Signal {
        name: "Deploy / release workflow".into(),
        found: has_deploy,
        details: String::new(),
        points: 15,
    });

    // PR-triggered checks (15 pts)
    let has_pr = workflow_paths.iter().any(|p| {
        ctx.file_content(p)
            .map(|c| c.contains("pull_request"))
            .unwrap_or(false)
    });
    signals.push(Signal {
        name: "PR-triggered checks".into(),
        found: has_pr,
        details: String::new(),
        points: 15,
    });

    // Dockerfile (10 pts)
    let has_dockerfile = ctx.has_path("Dockerfile")
        || ctx.has_path_matching(|p| {
            let basename = p.rsplit('/').next().unwrap_or(p);
            basename.starts_with("Dockerfile")
        });
    signals.push(Signal {
        name: "Dockerfile".into(),
        found: has_dockerfile,
        details: String::new(),
        points: 10,
    });

    // Docker Compose (5 pts)
    let has_compose = ctx.has_path("docker-compose.yml")
        || ctx.has_path("docker-compose.yaml")
        || ctx.has_path("compose.yml")
        || ctx.has_path("compose.yaml");
    signals.push(Signal {
        name: "Docker Compose".into(),
        found: has_compose,
        details: String::new(),
        points: 5,
    });

    // Makefile (5 pts)
    signals.push(Signal {
        name: "Makefile".into(),
        found: ctx.has_path("Makefile"),
        details: String::new(),
        points: 5,
    });

    signals
}

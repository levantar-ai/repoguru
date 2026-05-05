//! Dependencies category analyzer (weight: 0.15).

use super::tree_reader::TreeContext;
use super::Signal;

const MANIFESTS: &[&str] = &[
    "package.json",
    "Cargo.toml",
    "go.mod",
    "requirements.txt",
    "Pipfile",
    "pyproject.toml",
    "Gemfile",
    "composer.json",
    "pom.xml",
    "build.gradle",
    "build.gradle.kts",
];

const LOCKFILES: &[&str] = &[
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "go.sum",
    "Gemfile.lock",
    "composer.lock",
    "Pipfile.lock",
    "poetry.lock",
];

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    // Dependency manifest (30 pts)
    let found_manifests: Vec<&str> = MANIFESTS
        .iter()
        .filter(|m| ctx.has_path(m))
        .copied()
        .collect();
    signals.push(Signal {
        name: "Dependency manifest".into(),
        found: !found_manifests.is_empty(),
        details: if !found_manifests.is_empty() {
            found_manifests.join(", ")
        } else {
            String::new()
        },
        points: 30,
    });

    // Lockfile present (25 pts)
    let found_lockfiles: Vec<&str> = LOCKFILES
        .iter()
        .filter(|l| ctx.has_path(l))
        .copied()
        .collect();
    signals.push(Signal {
        name: "Lockfile present".into(),
        found: !found_lockfiles.is_empty(),
        details: if !found_lockfiles.is_empty() {
            found_lockfiles.join(", ")
        } else {
            String::new()
        },
        points: 25,
    });

    // Dependencies tracked (20 pts) — parse manifest to check dep count
    let dep_count = count_dependencies(ctx);
    signals.push(Signal {
        name: "Dependencies tracked".into(),
        found: dep_count > 0,
        details: if dep_count > 0 {
            format!("{dep_count} dependencies")
        } else {
            String::new()
        },
        points: 20,
    });

    // Reasonable dependency count <200 (15 pts)
    signals.push(Signal {
        name: "Reasonable dependency count".into(),
        found: dep_count > 0 && dep_count < 200,
        details: if dep_count > 0 {
            format!("{dep_count} dependencies")
        } else {
            "No dependencies found".into()
        },
        points: 15,
    });

    // Tech stack detected (10 pts) — at least one framework/language indicator
    let has_tech = !found_manifests.is_empty()
        || ctx.has_path("tsconfig.json")
        || ctx.has_path("Makefile")
        || ctx.has_path_matching(|p| p.ends_with(".rs") || p.ends_with(".go") || p.ends_with(".py"));
    signals.push(Signal {
        name: "Tech stack detected".into(),
        found: has_tech,
        details: String::new(),
        points: 10,
    });

    signals
}

/// Count dependencies from the primary manifest file.
fn count_dependencies(ctx: &TreeContext) -> usize {
    // Try package.json
    if let Some(content) = ctx.file_content("package.json") {
        return count_npm_deps(content);
    }
    // Try Cargo.toml
    if let Some(content) = ctx.file_content("Cargo.toml") {
        return count_cargo_deps(content);
    }
    // Try go.mod
    if let Some(content) = ctx.file_content("go.mod") {
        return count_go_deps(content);
    }
    // Try requirements.txt
    if let Some(content) = ctx.file_content("requirements.txt") {
        return count_requirements_deps(content);
    }
    // Try pyproject.toml
    if let Some(content) = ctx.file_content("pyproject.toml") {
        return count_pyproject_deps(content);
    }
    0
}

fn count_npm_deps(content: &str) -> usize {
    // Simple JSON parsing: count entries in "dependencies" and "devDependencies"
    let mut count = 0;
    let mut in_deps = false;
    let mut brace_depth = 0;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.contains("\"dependencies\"") || trimmed.contains("\"devDependencies\"") {
            in_deps = true;
            brace_depth = 0;
        }
        if in_deps {
            for ch in trimmed.chars() {
                if ch == '{' {
                    brace_depth += 1;
                } else if ch == '}' {
                    brace_depth -= 1;
                    if brace_depth == 0 {
                        in_deps = false;
                    }
                }
            }
            if trimmed.contains("\": \"") || trimmed.contains("\":\"") {
                count += 1;
            }
        }
    }
    count
}

fn count_cargo_deps(content: &str) -> usize {
    // Count lines under [dependencies] until next [section]
    let mut count = 0;
    let mut in_deps = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "[dependencies]"
            || trimmed == "[dev-dependencies]"
            || trimmed == "[build-dependencies]"
        {
            in_deps = true;
            continue;
        }
        if trimmed.starts_with('[') {
            in_deps = false;
            continue;
        }
        if in_deps && trimmed.contains('=') && !trimmed.starts_with('#') {
            count += 1;
        }
    }
    count
}

fn count_go_deps(content: &str) -> usize {
    content
        .lines()
        .filter(|l| {
            let t = l.trim();
            !t.is_empty()
                && !t.starts_with("//")
                && !t.starts_with("module ")
                && !t.starts_with("go ")
                && !t.starts_with("require")
                && t != "("
                && t != ")"
                && !t.starts_with("replace")
                && !t.starts_with("exclude")
        })
        .count()
}

fn count_requirements_deps(content: &str) -> usize {
    content
        .lines()
        .filter(|l| {
            let t = l.trim();
            !t.is_empty() && !t.starts_with('#') && !t.starts_with('-')
        })
        .count()
}

fn count_pyproject_deps(content: &str) -> usize {
    // Count entries under [project.dependencies] or [tool.poetry.dependencies]
    let mut count = 0;
    let mut in_deps = false;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.contains("dependencies") && trimmed.starts_with('[') {
            in_deps = true;
            continue;
        }
        if in_deps && trimmed.starts_with('[') {
            in_deps = false;
            continue;
        }
        if in_deps {
            if trimmed.contains('=') && !trimmed.starts_with('#') {
                count += 1;
            } else if trimmed.starts_with('"') || trimmed.starts_with('\'') {
                count += 1; // array-style deps
            }
        }
    }
    count
}

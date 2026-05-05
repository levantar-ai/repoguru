//! OpenSSF category analyzer (weight: 0.10).
//! Checks for supply chain security best practices aligned with OpenSSF Scorecard.

use super::tree_reader::TreeContext;
use super::Signal;

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    let workflow_paths = ctx.paths_matching(|p| {
        p.starts_with(".github/workflows/") && (p.ends_with(".yml") || p.ends_with(".yaml"))
    });

    // Collect all workflow content for reuse
    let workflow_contents: Vec<(&str, &str)> = workflow_paths
        .iter()
        .filter_map(|p| ctx.file_content(p).map(|c| (*p, c)))
        .collect();

    // Token permissions (15 pts) — workflows declare `permissions:`
    let has_permissions = workflow_contents
        .iter()
        .any(|(_, c)| c.contains("permissions:"));
    signals.push(Signal {
        name: "Token permissions".into(),
        found: has_permissions,
        details: String::new(),
        points: 15,
    });

    // Pinned dependencies (15 pts) — Actions use @<SHA> refs
    let has_pinned = workflow_contents.iter().any(|(_, c)| {
        c.lines().any(|line| {
            let trimmed = line.trim();
            if trimmed.starts_with("uses:") || trimmed.starts_with("- uses:") {
                // Check for @<40-hex-char-SHA>
                if let Some(at_pos) = trimmed.rfind('@') {
                    let ref_part = &trimmed[at_pos + 1..];
                    let ref_part = ref_part.trim();
                    ref_part.len() >= 40
                        && ref_part.chars().take(40).all(|c| c.is_ascii_hexdigit())
                } else {
                    false
                }
            } else {
                false
            }
        })
    });
    signals.push(Signal {
        name: "Pinned dependencies".into(),
        found: has_pinned,
        details: String::new(),
        points: 15,
    });

    // No dangerous workflow patterns (10 pts) — no pull_request_target + checkout of PR head
    let has_dangerous = workflow_contents.iter().any(|(_, c)| {
        c.contains("pull_request_target") && c.contains("github.event.pull_request.head")
    });
    signals.push(Signal {
        name: "No dangerous workflow patterns".into(),
        found: !has_dangerous,
        details: if has_dangerous {
            "pull_request_target with PR head checkout detected".into()
        } else {
            String::new()
        },
        points: 10,
    });

    // No binary artifacts (10 pts)
    let binary_extensions = [".exe", ".dll", ".jar", ".so", ".class", ".pyc", ".wasm"];
    let has_binaries = ctx.has_path_matching(|p| {
        binary_extensions.iter().any(|ext| p.ends_with(ext))
    });
    signals.push(Signal {
        name: "No binary artifacts".into(),
        found: !has_binaries,
        details: if has_binaries {
            "Binary artifacts found in tree".into()
        } else {
            String::new()
        },
        points: 10,
    });

    // SLSA / signed releases (10 pts)
    let has_slsa = workflow_contents.iter().any(|(_, c)| {
        let lower = c.to_lowercase();
        lower.contains("slsa")
            || lower.contains("provenance")
            || lower.contains("sigstore")
            || lower.contains("cosign")
    });
    signals.push(Signal {
        name: "SLSA / signed releases".into(),
        found: has_slsa,
        details: String::new(),
        points: 10,
    });

    // Fuzzing (10 pts)
    let has_fuzzing = ctx.has_path_matching(|p| {
        let lower = p.to_lowercase();
        lower.contains("fuzz") || lower.contains("oss-fuzz")
    }) || workflow_contents.iter().any(|(_, c)| {
        let lower = c.to_lowercase();
        lower.contains("fuzz")
    });
    signals.push(Signal {
        name: "Fuzzing".into(),
        found: has_fuzzing,
        details: String::new(),
        points: 10,
    });

    // SBOM generation (10 pts)
    let has_sbom = workflow_contents.iter().any(|(_, c)| {
        let lower = c.to_lowercase();
        lower.contains("cyclonedx")
            || lower.contains("spdx")
            || lower.contains("sbom")
            || lower.contains("syft")
    });
    signals.push(Signal {
        name: "SBOM generation".into(),
        found: has_sbom,
        details: String::new(),
        points: 10,
    });

    // Dependency update tool (10 pts)
    let has_dep_updates = ctx.has_path(".github/dependabot.yml")
        || ctx.has_path(".github/dependabot.yaml")
        || ctx.has_path("renovate.json")
        || ctx.has_path(".github/renovate.json")
        || ctx.has_path(".renovaterc")
        || ctx.has_path(".renovaterc.json");
    signals.push(Signal {
        name: "Dependency update tool".into(),
        found: has_dep_updates,
        details: String::new(),
        points: 10,
    });

    // Security policy (5 pts)
    signals.push(Signal {
        name: "Security policy".into(),
        found: ctx.has_file_ci("SECURITY.md") || ctx.has_path(".github/SECURITY.md"),
        details: String::new(),
        points: 5,
    });

    // License detected (5 pts)
    let has_license = ["LICENSE", "LICENCE", "COPYING", "LICENSE.md", "LICENSE.txt"]
        .iter()
        .any(|f| ctx.has_path(f));
    signals.push(Signal {
        name: "License detected".into(),
        found: has_license,
        details: String::new(),
        points: 5,
    });

    signals
}

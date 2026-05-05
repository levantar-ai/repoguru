//! Documentation category analyzer (weight: 0.15).

use super::tree_reader::TreeContext;
use super::Signal;

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    // README exists (25 pts)
    let readme_path = find_readme(ctx);
    signals.push(Signal {
        name: "README exists".into(),
        found: readme_path.is_some(),
        details: readme_path
            .as_deref()
            .map(|p| p.to_string())
            .unwrap_or_default(),
        points: 25,
    });

    // Substantial README >500 chars (20 pts)
    let readme_content = readme_path
        .as_deref()
        .and_then(|p| ctx.file_content(p));
    let readme_len = readme_content.map(|c| c.len()).unwrap_or(0);
    signals.push(Signal {
        name: "Substantial README (>500 chars)".into(),
        found: readme_len > 500,
        details: if readme_len > 0 {
            format!("{readme_len} characters")
        } else {
            String::new()
        },
        points: 20,
    });

    // README has sections (≥3 headings) (15 pts)
    let heading_count = readme_content
        .map(|c| count_markdown_headings(c))
        .unwrap_or(0);
    signals.push(Signal {
        name: "README has sections".into(),
        found: heading_count >= 3,
        details: if heading_count > 0 {
            format!("{heading_count} headings")
        } else {
            String::new()
        },
        points: 15,
    });

    // Code examples in README (10 pts)
    let has_code_blocks = readme_content
        .map(|c| c.contains("```"))
        .unwrap_or(false);
    signals.push(Signal {
        name: "Code examples in README".into(),
        found: has_code_blocks,
        details: String::new(),
        points: 10,
    });

    // CONTRIBUTING.md (10 pts)
    let has_contributing = ctx.has_file_ci("CONTRIBUTING.md");
    signals.push(Signal {
        name: "CONTRIBUTING.md".into(),
        found: has_contributing,
        details: String::new(),
        points: 10,
    });

    // CHANGELOG (10 pts)
    let has_changelog = ctx.has_file_ci("CHANGELOG.md")
        || ctx.has_file_ci("CHANGES.md")
        || ctx.has_file_ci("HISTORY.md")
        || ctx.has_file_ci("CHANGELOG");
    signals.push(Signal {
        name: "CHANGELOG".into(),
        found: has_changelog,
        details: String::new(),
        points: 10,
    });

    // docs/ directory (10 pts)
    let has_docs_dir = ctx.has_path_matching(|p| {
        p.starts_with("docs/") || p.starts_with("doc/")
    });
    signals.push(Signal {
        name: "docs/ directory".into(),
        found: has_docs_dir,
        details: String::new(),
        points: 10,
    });

    signals
}

fn find_readme(ctx: &TreeContext) -> Option<String> {
    let names = ["README.md", "readme.md", "README.rst", "README", "README.txt"];
    for name in &names {
        if ctx.has_path(name) {
            return Some(name.to_string());
        }
    }
    // Case-insensitive fallback
    ctx.find_file_ci("README.md").map(|s| s.to_string())
}

fn count_markdown_headings(content: &str) -> usize {
    content
        .lines()
        .filter(|line| {
            let trimmed = line.trim_start();
            trimmed.starts_with('#') && trimmed.len() > 1 && trimmed.chars().nth(1) != Some('#')
                || trimmed.starts_with("## ")
                || trimmed.starts_with("### ")
                || trimmed.starts_with("# ")
        })
        .count()
}

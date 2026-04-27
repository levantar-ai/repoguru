//! Code Quality category analyzer (weight: 0.15).

use super::tree_reader::TreeContext;
use super::Signal;

pub fn analyze(ctx: &TreeContext) -> Vec<Signal> {
    let mut signals = Vec::new();

    // Linter configured (20 pts)
    let linter_files = [
        ".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.yml", ".eslintrc.yaml",
        ".flake8", ".pylintrc", "clippy.toml", ".clippy.toml",
        ".rubocop.yml", ".golangci.yml", ".golangci.yaml",
        "biome.json", ".ruff.toml", "ruff.toml",
    ];
    let has_linter = linter_files.iter().any(|f| ctx.has_path(f))
        || ctx.has_path_matching(|p| p.starts_with("eslint.config."));
    signals.push(Signal {
        name: "Linter configured".into(),
        found: has_linter,
        details: String::new(),
        points: 20,
    });

    // Formatter configured (15 pts)
    let formatter_files = [
        ".prettierrc", ".prettierrc.js", ".prettierrc.json", ".prettierrc.yml",
        "rustfmt.toml", ".clang-format", "biome.json", ".editorconfig",
    ];
    let has_formatter = formatter_files.iter().any(|f| ctx.has_path(f))
        || ctx.has_path_matching(|p| p.starts_with("prettier.config."));
    signals.push(Signal {
        name: "Formatter configured".into(),
        found: has_formatter,
        details: String::new(),
        points: 15,
    });

    // Type system (15 pts)
    let has_types = ctx.has_path("tsconfig.json")
        || ctx.has_path("mypy.ini")
        || ctx.has_path(".mypy.ini")
        || ctx.has_path("pyright.json")
        || ctx.has_path("pyrightconfig.json");
    signals.push(Signal {
        name: "Type system".into(),
        found: has_types,
        details: String::new(),
        points: 15,
    });

    // Git hooks (10 pts)
    let has_hooks = ctx.has_path_matching(|p| p.starts_with(".husky/"))
        || ctx.has_path(".pre-commit-config.yaml")
        || ctx.has_path("lefthook.yml")
        || ctx.has_path(".lefthook.yml");
    signals.push(Signal {
        name: "Git hooks".into(),
        found: has_hooks,
        details: String::new(),
        points: 10,
    });

    // Tests present (20 pts)
    let has_tests = ctx.has_path_matching(|p| {
        // Test directories
        let parts: Vec<&str> = p.split('/').collect();
        if parts.iter().any(|seg| matches!(*seg, "test" | "tests" | "__tests__" | "spec")) {
            return true;
        }
        // Test files by naming convention
        let basename = parts.last().unwrap_or(&"");
        basename.ends_with(".test.ts")
            || basename.ends_with(".test.js")
            || basename.ends_with(".test.tsx")
            || basename.ends_with(".test.jsx")
            || basename.ends_with(".spec.ts")
            || basename.ends_with(".spec.js")
            || basename.ends_with("_test.go")
            || basename.ends_with("_test.rs")
            || basename.starts_with("test_") && basename.ends_with(".py")
    });
    signals.push(Signal {
        name: "Tests present".into(),
        found: has_tests,
        details: String::new(),
        points: 20,
    });

    // CI runs tests (10 pts)
    let ci_runs_tests = ctx
        .paths_matching(|p| {
            p.starts_with(".github/workflows/") && (p.ends_with(".yml") || p.ends_with(".yaml"))
        })
        .iter()
        .any(|p| {
            let content = ctx.file_content(p).unwrap_or("");
            content.contains("cargo test")
                || content.contains("npm test")
                || content.contains("yarn test")
                || content.contains("pytest")
                || content.contains("go test")
                || content.contains("jest")
                || content.contains("vitest")
                || content.contains("rspec")
                || content.contains("phpunit")
        });
    signals.push(Signal {
        name: "CI runs tests".into(),
        found: ci_runs_tests,
        details: String::new(),
        points: 10,
    });

    // EditorConfig (10 pts)
    signals.push(Signal {
        name: "EditorConfig".into(),
        found: ctx.has_path(".editorconfig"),
        details: String::new(),
        points: 10,
    });

    signals
}

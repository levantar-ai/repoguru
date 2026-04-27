//! File filtering for tech detection — select only relevant files from the tree.

use std::collections::BTreeSet;

use regex::Regex;

/// An entry from the git tree.
pub struct TreeEntry {
    pub path: String,
    pub size: u64,
}

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "vendor",
    "bower_components",
    "__pycache__",
    ".git",
    ".next",
    ".nuxt",
    ".cache",
    ".venv",
    "venv",
    "env",
];

fn is_skipped_path(path: &str) -> bool {
    path.split('/').any(|seg| SKIP_DIRS.contains(&seg))
}

fn basename(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn is_cfn_template(path: &str) -> bool {
    let cfn_ext = Regex::new(r"\.(ya?ml|json)$").unwrap();
    if !cfn_ext.is_match(path) {
        return false;
    }
    let patterns = [
        Regex::new(r"^template\.").unwrap(),
        Regex::new(r"\.template\.").unwrap(),
        Regex::new(r"^cloudformation/").unwrap(),
        Regex::new(r"^serverless\.ya?ml$").unwrap(),
        Regex::new(r"^sam\.ya?ml$").unwrap(),
    ];
    patterns.iter().any(|p| p.is_match(path))
}

/// Select files relevant for tech detection from a git tree listing.
/// Returns deduplicated paths sorted by insertion order.
pub fn filter_tech_files(tree: &[TreeEntry]) -> Vec<String> {
    let filtered: Vec<&TreeEntry> = tree.iter().filter(|e| !is_skipped_path(&e.path)).collect();

    let mut paths = Vec::new();
    let mut seen = BTreeSet::new();

    let mut add = |path: &str| {
        if seen.insert(path.to_string()) {
            paths.push(path.to_string());
        }
    };

    // package.json files (sorted by depth — root first)
    let mut package_jsons: Vec<&str> = filtered
        .iter()
        .filter(|e| e.path.ends_with("package.json"))
        .map(|e| e.path.as_str())
        .collect();
    package_jsons.sort_by_key(|p| p.split('/').count());
    for p in package_jsons {
        add(p);
    }

    // Python manifests
    let py_manifests = [
        "requirements.txt",
        "pyproject.toml",
        "Pipfile",
        "setup.py",
        "setup.cfg",
    ];
    for e in &filtered {
        if py_manifests.contains(&basename(&e.path)) {
            add(&e.path);
        }
    }

    // requirements/*.txt
    let req_re = Regex::new(r"^requirements/.*\.txt$").unwrap();
    for e in &filtered {
        if req_re.is_match(&e.path) {
            add(&e.path);
        }
    }

    // Terraform files (root, terraform/, infra/)
    let tf_re = Regex::new(r"^(terraform/|infra/|[^/]+\.tf$)").unwrap();
    for e in &filtered {
        if e.path.ends_with(".tf") && tf_re.is_match(&e.path) {
            add(&e.path);
        }
    }

    // CloudFormation templates
    for e in &filtered {
        if is_cfn_template(&e.path) {
            add(&e.path);
        }
    }

    // Python source files < 100KB (for boto3 detection)
    for e in &filtered {
        if e.path.ends_with(".py") && e.size < 100_000 {
            add(&e.path);
        }
    }

    // Go modules
    for e in &filtered {
        if e.path.ends_with("go.mod") {
            add(&e.path);
        }
    }

    // Java build files
    for e in &filtered {
        let b = basename(&e.path);
        if b == "pom.xml" || b == "build.gradle" || b == "build.gradle.kts" {
            add(&e.path);
        }
    }

    // PHP
    for e in &filtered {
        if e.path.ends_with("composer.json") {
            add(&e.path);
        }
    }

    // Rust
    for e in &filtered {
        if e.path.ends_with("Cargo.toml") {
            add(&e.path);
        }
    }

    // Ruby
    for e in &filtered {
        if e.path.ends_with("Gemfile") {
            add(&e.path);
        }
    }

    // Bicep
    for e in &filtered {
        if e.path.ends_with(".bicep") {
            add(&e.path);
        }
    }

    // ARM templates
    for e in &filtered {
        if e.path.ends_with(".json")
            && (e.path.contains("arm")
                || e.path.contains("template")
                || e.path.contains("azuredeploy"))
        {
            add(&e.path);
        }
    }

    // CI/CD config files
    let cicd_patterns: Vec<Regex> = vec![
        Regex::new(r"^\.github/workflows/.*\.ya?ml$").unwrap(),
        Regex::new(r"^\.gitlab-ci\.ya?ml$").unwrap(),
        Regex::new(r"^\.circleci/").unwrap(),
        Regex::new(r"^Jenkinsfile$").unwrap(),
        Regex::new(r"^\.travis\.yml$").unwrap(),
        Regex::new(r"^azure-pipelines\.ya?ml$").unwrap(),
        Regex::new(r"^bitbucket-pipelines\.yml$").unwrap(),
        Regex::new(r"^\.buildkite/").unwrap(),
        Regex::new(r"^Dockerfile(\..+)?$").unwrap(),
        Regex::new(r"^docker-compose\.ya?ml$").unwrap(),
        Regex::new(r"^compose\.ya?ml$").unwrap(),
        Regex::new(r"^\.dockerignore$").unwrap(),
        Regex::new(r"^(kubernetes|k8s)/").unwrap(),
        Regex::new(r"^Chart\.yaml$").unwrap(),
        Regex::new(r"^(charts|helm)/.*Chart\.yaml$").unwrap(),
        Regex::new(r"^skaffold\.yaml$").unwrap(),
        Regex::new(r"^Makefile$").unwrap(),
        Regex::new(r"^Taskfile\.ya?ml$").unwrap(),
        Regex::new(r"^justfile$").unwrap(),
        Regex::new(r"^Earthfile$").unwrap(),
        Regex::new(r"^pulumi\.ya?ml$").unwrap(),
        Regex::new(r"^Pulumi\.\w+\.ya?ml$").unwrap(),
        Regex::new(r"^serverless\.ya?ml$").unwrap(),
        Regex::new(r"^\.terraform\.lock\.hcl$").unwrap(),
        Regex::new(r"^terragrunt\.hcl$").unwrap(),
    ];
    for e in &filtered {
        if cicd_patterns.iter().any(|p| p.is_match(&e.path)) {
            add(&e.path);
        }
    }

    // Testing/quality config files
    let testing_patterns: Vec<Regex> = vec![
        Regex::new(r"^\.eslintrc").unwrap(),
        Regex::new(r"^eslint\.config\.").unwrap(),
        Regex::new(r"^\.prettierrc").unwrap(),
        Regex::new(r"^prettier\.config\.").unwrap(),
        Regex::new(r"^jest\.config\.").unwrap(),
        Regex::new(r"^vitest\.config\.").unwrap(),
        Regex::new(r"^playwright\.config\.").unwrap(),
        Regex::new(r"^cypress\.config\.").unwrap(),
        Regex::new(r"^\.storybook/").unwrap(),
        Regex::new(r"^biome\.json$").unwrap(),
        Regex::new(r"^\.ruff\.toml$").unwrap(),
        Regex::new(r"^\.flake8$").unwrap(),
        Regex::new(r"^\.pylintrc$").unwrap(),
        Regex::new(r"^mypy\.ini$").unwrap(),
        Regex::new(r"^\.mypy\.ini$").unwrap(),
        Regex::new(r"^tox\.ini$").unwrap(),
        Regex::new(r"^\.rubocop\.yml$").unwrap(),
        Regex::new(r"^\.husky/").unwrap(),
        Regex::new(r"^commitlint\.config\.").unwrap(),
        Regex::new(r"^\.commitlintrc").unwrap(),
    ];
    for e in &filtered {
        let b = basename(&e.path);
        if testing_patterns
            .iter()
            .any(|p| p.is_match(&e.path) || p.is_match(b))
        {
            add(&e.path);
        }
    }

    paths
}

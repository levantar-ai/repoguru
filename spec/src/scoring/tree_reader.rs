//! Read HEAD tree entries and file content via gix.
//! Provides a TreeContext that category analyzers use for signal detection.

use std::collections::BTreeMap;
use std::path::Path;

use crate::error::ScanError;

/// An entry from the HEAD tree (blob only).
#[derive(Debug, Clone)]
pub struct TreeEntry {
    pub path: String,
    pub size: u64,
}

/// Context passed to each category analyzer.
pub struct TreeContext {
    /// All blob entries in the HEAD tree.
    pub entries: Vec<TreeEntry>,
    /// Content of specific files fetched from the object DB (path → UTF-8 content).
    pub files: BTreeMap<String, String>,
    /// All blob paths as a set for quick lookups.
    pub path_set: std::collections::BTreeSet<String>,
}

impl TreeContext {
    /// Build a TreeContext by reading the HEAD tree of the given repository.
    pub fn from_repo(
        repo_path: &Path,
        _scan_out: Option<&Path>,
    ) -> Result<Self, ScanError> {
        let repo = gix::open(repo_path)
            .map_err(|e| ScanError::RepoOpen(format!("{e}")))?;

        let head = repo
            .head_commit()
            .map_err(|e| ScanError::ScanFailed(format!("resolve HEAD: {e}")))?;
        let tree = head
            .tree()
            .map_err(|e| ScanError::ScanFailed(format!("read HEAD tree: {e}")))?;

        // Walk the tree recursively to collect all blob entries
        let mut entries = Vec::new();
        walk_tree(&repo, &tree, "", &mut entries)?;

        let path_set: std::collections::BTreeSet<String> =
            entries.iter().map(|e| e.path.clone()).collect();

        // Fetch content for files that scoring needs
        let target_files = collect_target_files(&path_set);
        let mut files = BTreeMap::new();
        for path in &target_files {
            if let Ok(content) = read_blob(&repo, path, &tree) {
                files.insert(path.clone(), content);
            }
        }

        Ok(TreeContext {
            entries,
            files,
            path_set,
        })
    }

    /// Check if a path exists in the tree.
    pub fn has_path(&self, path: &str) -> bool {
        self.path_set.contains(path)
    }

    /// Check if any path matches a predicate.
    pub fn has_path_matching(&self, pred: impl Fn(&str) -> bool) -> bool {
        self.path_set.iter().any(|p| pred(p))
    }

    /// Get paths matching a predicate.
    pub fn paths_matching(&self, pred: impl Fn(&str) -> bool) -> Vec<&str> {
        self.path_set.iter().filter(|p| pred(p)).map(|p| p.as_str()).collect()
    }

    /// Get file content if available.
    pub fn file_content(&self, path: &str) -> Option<&str> {
        self.files.get(path).map(|s| s.as_str())
    }

    /// Check if a path exists (case-insensitive basename match).
    pub fn has_file_ci(&self, name: &str) -> bool {
        let name_lower = name.to_lowercase();
        self.path_set
            .iter()
            .any(|p| {
                let basename = p.rsplit('/').next().unwrap_or(p);
                basename.to_lowercase() == name_lower
            })
    }

    /// Find a file by case-insensitive basename, returning the first match path.
    pub fn find_file_ci(&self, name: &str) -> Option<&str> {
        let name_lower = name.to_lowercase();
        self.path_set
            .iter()
            .find(|p| {
                let basename = p.rsplit('/').next().unwrap_or(p);
                basename.to_lowercase() == name_lower
            })
            .map(|p| p.as_str())
    }
}

/// Determine which files to fetch content for based on scoring needs.
fn collect_target_files(path_set: &std::collections::BTreeSet<String>) -> Vec<String> {
    let mut targets = Vec::new();

    // README variants
    let readme_names = ["README.md", "README.rst", "readme.md", "README", "README.txt"];
    for name in &readme_names {
        if path_set.contains(*name) {
            targets.push(name.to_string());
        }
    }

    // LICENSE variants
    let license_names = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "LICENCE", "LICENCE.md"];
    for name in &license_names {
        if path_set.contains(*name) {
            targets.push(name.to_string());
        }
    }

    // Workflow files (for CI/CD, security, OpenSSF analysis)
    for path in path_set {
        if path.starts_with(".github/workflows/") && (path.ends_with(".yml") || path.ends_with(".yaml")) {
            targets.push(path.clone());
        }
    }

    // Dependency manifests
    let manifests = [
        "package.json", "Cargo.toml", "go.mod", "requirements.txt",
        "Pipfile", "pyproject.toml", "Gemfile", "composer.json",
        "pom.xml", "build.gradle", "build.gradle.kts",
    ];
    for name in &manifests {
        if path_set.contains(*name) {
            targets.push(name.to_string());
        }
    }

    // Lockfiles
    let lockfiles = [
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "Cargo.lock", "go.sum", "Gemfile.lock", "composer.lock",
        "Pipfile.lock", "poetry.lock",
    ];
    for name in &lockfiles {
        if path_set.contains(*name) {
            targets.push((*name).to_string());
        }
    }

    // Dependabot / Renovate
    for name in &[".github/dependabot.yml", ".github/dependabot.yaml", "renovate.json", ".github/renovate.json"] {
        if path_set.contains(*name) {
            targets.push(name.to_string());
        }
    }

    targets
}

/// Recursively walk a git tree, collecting blob entries.
fn walk_tree(
    repo: &gix::Repository,
    tree: &gix::Tree<'_>,
    prefix: &str,
    entries: &mut Vec<TreeEntry>,
) -> Result<(), ScanError> {
    for entry in tree.iter() {
        let entry = entry.map_err(|e| ScanError::ScanFailed(format!("tree iter: {e}")))?;
        let name = std::str::from_utf8(entry.filename())
            .unwrap_or("<non-utf8>")
            .to_string();
        let path = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };

        let mode = entry.mode();
        if mode.is_blob() {
            let size = repo
                .find_object(entry.oid().to_owned())
                .map(|o| o.data.len() as u64)
                .unwrap_or(0);
            entries.push(TreeEntry { path, size });
        } else if mode.is_tree() {
            // Skip common vendored directories for performance
            let basename = path.rsplit('/').next().unwrap_or(&path);
            if matches!(basename, "node_modules" | "vendor" | ".git" | "__pycache__" | ".next") {
                continue;
            }
            let sub_obj = repo
                .find_object(entry.oid().to_owned())
                .map_err(|e| ScanError::ScanFailed(format!("find subtree: {e}")))?;
            let sub_tree = sub_obj.into_tree();
            walk_tree(repo, &sub_tree, &path, entries)?;
        }
    }
    Ok(())
}

/// Read a blob's content from the tree as a UTF-8 string.
fn read_blob(
    repo: &gix::Repository,
    path: &str,
    tree: &gix::Tree<'_>,
) -> Result<String, ScanError> {
    let entry = tree
        .lookup_entry_by_path(path)
        .map_err(|e| ScanError::ScanFailed(format!("lookup {path}: {e}")))?
        .ok_or_else(|| ScanError::ScanFailed(format!("path not found: {path}")))?;

    let obj = repo
        .find_object(entry.oid().to_owned())
        .map_err(|e| ScanError::ScanFailed(format!("read blob {path}: {e}")))?;

    Ok(String::from_utf8_lossy(&obj.data).to_string())
}

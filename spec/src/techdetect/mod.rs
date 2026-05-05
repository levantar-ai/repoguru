//! Technology detection engine — detects languages, frameworks, databases,
//! cloud services, CI/CD tools, and testing tools from a git repository's HEAD tree.

pub mod detect;
pub mod filter;
pub mod rules;
pub mod types;

use std::collections::BTreeSet;
use std::path::Path;

use crate::error::ScanError;
use filter::TreeEntry;
use types::{FileInput, TechDetectResult};

/// Run tech detection on a repository, reading files from HEAD tree.
pub fn run_detect_tech(repo_path: &Path) -> Result<TechDetectResult, ScanError> {
    let repo = gix::open(repo_path).map_err(|e| ScanError::RepoOpen(format!("{e}")))?;

    // Find HEAD commit's tree
    let head = repo
        .head_commit()
        .map_err(|e| ScanError::ScanFailed(format!("resolve HEAD: {e}")))?;
    let tree = head
        .tree()
        .map_err(|e| ScanError::ScanFailed(format!("read HEAD tree: {e}")))?;

    // Walk the tree recursively to collect all blob entries
    let mut all_entries = Vec::new();
    walk_tree(&repo, &tree, "", &mut all_entries)?;

    let total_files = all_entries.len() as u64;

    // Collect all paths for language detection
    let all_paths: Vec<String> = all_entries.iter().map(|e| e.path.clone()).collect();

    // Filter to tech-relevant files
    let selected_paths = filter::filter_tech_files(&all_entries);
    let selected_set: BTreeSet<&str> = selected_paths.iter().map(|s| s.as_str()).collect();

    // Read content for selected files
    let mut files = Vec::new();
    for entry in &all_entries {
        if selected_set.contains(entry.path.as_str()) {
            if let Ok(content) = read_blob(&repo, &entry.path, &tree) {
                files.push(FileInput {
                    path: entry.path.clone(),
                    content,
                });
            }
        }
    }

    let manifest_files: Vec<String> = files.iter().map(|f| f.path.clone()).collect();

    // Run all detection functions
    let aws = detect::detect_aws(&files);
    let azure = detect::detect_azure(&files);
    let gcp = detect::detect_gcp(&files);
    let python = detect::detect_python(&files);
    let node = detect::detect_node(&files);
    let go = detect::detect_go(&files);
    let java = detect::detect_java(&files);
    let php = detect::detect_php(&files);
    let rust = detect::detect_rust(&files);
    let ruby = detect::detect_ruby(&files);
    let frameworks = detect::detect_frameworks(&files);
    let databases = detect::detect_databases(&files);
    let cicd = detect::detect_cicd(&files);
    let testing = detect::detect_testing(&files);
    let languages = detect::detect_languages(&all_paths);

    Ok(TechDetectResult {
        aws,
        azure,
        gcp,
        python,
        node,
        go,
        java,
        php,
        rust,
        ruby,
        frameworks,
        databases,
        cicd,
        testing,
        languages,
        manifest_files,
        total_files,
    })
}

/// Recursively walk a git tree, collecting blob entries with paths and sizes.
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
            name.clone()
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

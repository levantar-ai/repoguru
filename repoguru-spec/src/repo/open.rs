use std::path::Path;

use crate::error::ScanError;

/// Open a git repository from a path (§4.1–§4.3).
///
/// The path can be:
/// - A worktree root containing `.git/`
/// - A bare repo directory
/// - A `.git` directory itself
///
/// Enables object cache for fast tree diffs (avoids re-decompressing
/// the same tree objects from pack files repeatedly).
pub fn open_repo(path: &Path) -> Result<gix::Repository, ScanError> {
    let mut repo = gix::open(path).map_err(|e| ScanError::RepoOpen(e.to_string()))?;

    // Enable object cache — critical for tree diff performance.
    // Without this, every subtree lookup decompresses from the pack file.
    // git CLI does this automatically; gix requires explicit opt-in.
    repo.object_cache_size_if_unset(128 * 1024 * 1024); // 128 MB cache

    Ok(repo)
}

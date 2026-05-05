use std::path::{Path, PathBuf};

use crate::error::ScanError;

/// Resolve a repo argument that may be a local path or a remote URL.
///
/// - If it looks like a URL (starts with `https://`, `http://`, `git://`, or `git@`),
///   clones (or reuses an existing clone) under `cache_dir` and returns the clone path.
/// - Otherwise returns the path as-is.
pub fn resolve_repo(repo_arg: &Path, cache_dir: &Path) -> Result<PathBuf, ScanError> {
    let arg_str = repo_arg.to_string_lossy();

    if is_remote_url(&arg_str) {
        let dest = clone_dest_for_url(&arg_str, cache_dir);
        clone_or_reuse(&arg_str, &dest)?;
        Ok(dest)
    } else {
        if !repo_arg.exists() {
            return Err(ScanError::RepoOpen(format!(
                "path does not exist: {}",
                repo_arg.display()
            )));
        }
        Ok(repo_arg.to_path_buf())
    }
}

/// Returns true if the string looks like a remote git URL.
fn is_remote_url(s: &str) -> bool {
    s.starts_with("https://")
        || s.starts_with("http://")
        || s.starts_with("git://")
        || s.starts_with("git@")
}

/// Derive a stable cache directory name from a URL.
///
/// e.g. `https://github.com/dotnet/aspnetcore.git` → `github.com_dotnet_aspnetcore`
fn clone_dest_for_url(url: &str, cache_dir: &Path) -> PathBuf {
    let name = url
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .replace("https://", "")
        .replace("http://", "")
        .replace("git://", "")
        .replace("git@", "")
        .replace(':', "/")
        .replace('/', "_");
    cache_dir.join(name)
}

/// Clone a repo using gix if not already present. Reuses existing valid clones.
fn clone_or_reuse(url: &str, dest: &Path) -> Result<(), ScanError> {
    if dest.exists() {
        if gix::open(dest).is_ok() {
            eprintln!("Using cached clone: {}", dest.display());
            return Ok(());
        }
        // Invalid repo — remove and re-clone
        std::fs::remove_dir_all(dest).map_err(|e| {
            ScanError::ScanFailed(format!("failed to clean {}: {e}", dest.display()))
        })?;
    }

    eprintln!("Cloning {} → {} ...", url, dest.display());

    let parsed_url = gix::url::parse(url.into())
        .map_err(|e| ScanError::ScanFailed(format!("invalid URL {url}: {e}")))?;

    std::fs::create_dir_all(dest.parent().unwrap_or(dest)).map_err(|e| {
        ScanError::ScanFailed(format!("failed to create cache dir: {e}"))
    })?;

    let mut prepare = gix::prepare_clone_bare(parsed_url, dest)
        .map_err(|e| ScanError::ScanFailed(format!("clone prepare failed: {e}")))?;

    prepare
        .fetch_only(
            gix::progress::Discard,
            &std::sync::atomic::AtomicBool::new(false),
        )
        .map_err(|e| ScanError::ScanFailed(format!("clone fetch failed: {e}")))?;

    eprintln!("Clone complete.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_remote_url() {
        assert!(is_remote_url("https://github.com/dotnet/aspnetcore.git"));
        assert!(is_remote_url("git@github.com:dotnet/aspnetcore.git"));
        assert!(!is_remote_url("/home/user/repos/myrepo"));
        assert!(!is_remote_url("./relative/path"));
    }

    #[test]
    fn test_clone_dest_for_url() {
        let dir = PathBuf::from("/tmp/cache");
        assert_eq!(
            clone_dest_for_url("https://github.com/dotnet/aspnetcore.git", &dir),
            PathBuf::from("/tmp/cache/github.com_dotnet_aspnetcore")
        );
        assert_eq!(
            clone_dest_for_url("git@github.com:rust-lang/rust.git", &dir),
            PathBuf::from("/tmp/cache/github.com_rust-lang_rust")
        );
    }
}

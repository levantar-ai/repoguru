use std::path::Path;

/// Parse the `origin` remote of a gix repository and extract (owner, repo) if it
/// points to GitHub.
///
/// Supports both HTTPS (`https://github.com/{owner}/{repo}(.git)?`) and SSH
/// (`git@github.com:{owner}/{repo}(.git)?`) forms.  Returns `None` for
/// non-GitHub remotes or when parsing fails.
///
/// Falls back to parsing the repo directory name if it matches the clone cache
/// naming convention (`github.com_owner_repo`).
pub fn parse_github_remote(repo: &gix::Repository) -> Option<(String, String)> {
    // Try reading the origin remote URL
    if let Some(result) = try_parse_remote(repo) {
        return Some(result);
    }

    // Fallback: parse the directory name (for cached bare clones)
    parse_from_path(repo.path())
}

fn try_parse_remote(repo: &gix::Repository) -> Option<(String, String)> {
    let remote = repo.find_remote("origin").ok()?;
    let url = remote.url(gix::remote::Direction::Fetch)?;
    let url_str = url.to_bstring().to_string();
    parse_github_url(&url_str)
}

/// Parse owner/repo from a clone cache directory path.
/// Matches: `.../github.com_owner_repo` or `.../github.com_owner_repo/`
fn parse_from_path(path: &Path) -> Option<(String, String)> {
    let dir_name = path.file_name().or_else(|| path.parent()?.file_name())?;
    let name = dir_name.to_str()?;
    let rest = name.strip_prefix("github.com_")?;
    let mut parts = rest.splitn(2, '_');
    let owner = parts.next()?;
    let repo = parts.next()?;
    if owner.is_empty() || repo.is_empty() {
        return None;
    }
    Some((owner.to_string(), repo.to_string()))
}

/// Extract (owner, repo) from a GitHub URL string.
fn parse_github_url(url: &str) -> Option<(String, String)> {
    // Try HTTPS: https://github.com/{owner}/{repo}(.git)?
    let path = if let Some(rest) = url
        .strip_prefix("https://github.com/")
        .or_else(|| url.strip_prefix("http://github.com/"))
    {
        rest
    } else if let Some(rest) = url.strip_prefix("git@github.com:") {
        rest
    } else {
        return None;
    };

    let path = path.trim_end_matches('/').trim_end_matches(".git");

    let mut parts = path.splitn(3, '/');
    let owner = parts.next()?.to_string();
    let repo = parts.next()?.to_string();

    if owner.is_empty() || repo.is_empty() {
        return None;
    }

    // Ignore anything beyond owner/repo (shouldn't happen for remotes).
    Some((owner, repo))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn https_with_dotgit() {
        assert_eq!(
            parse_github_url("https://github.com/dotnet/aspnetcore.git"),
            Some(("dotnet".into(), "aspnetcore".into()))
        );
    }

    #[test]
    fn https_without_dotgit() {
        assert_eq!(
            parse_github_url("https://github.com/rust-lang/rust"),
            Some(("rust-lang".into(), "rust".into()))
        );
    }

    #[test]
    fn ssh_form() {
        assert_eq!(
            parse_github_url("git@github.com:torvalds/linux.git"),
            Some(("torvalds".into(), "linux".into()))
        );
    }

    #[test]
    fn non_github() {
        assert_eq!(
            parse_github_url("https://gitlab.com/foo/bar.git"),
            None
        );
    }

    #[test]
    fn empty_segments() {
        assert_eq!(parse_github_url("https://github.com//"), None);
        assert_eq!(parse_github_url("git@github.com:/.git"), None);
    }
}

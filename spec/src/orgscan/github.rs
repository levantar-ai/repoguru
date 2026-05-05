//! GitHub API client — list repos for an org or user.

use crate::error::ScanError;

/// Minimal repo info from the GitHub API.
#[derive(Debug, Clone)]
pub struct GitHubRepo {
    pub full_name: String,
    pub clone_url: String,
    pub fork: bool,
    pub archived: bool,
    pub default_branch: String,
}

/// List repositories for an org or user via the GitHub REST API.
pub fn list_repos(
    org_or_user: &str,
    is_user: bool,
    token: &str,
    max_repos: u32,
    skip_forks: bool,
    skip_archived: bool,
) -> Result<Vec<GitHubRepo>, ScanError> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("repoanalyze/0.1")
        .build()
        .map_err(|e| ScanError::ScanFailed(format!("HTTP client error: {e}")))?;

    let mut all_repos = Vec::new();
    let mut page = 1u32;
    let per_page = 100;

    loop {
        let url = if is_user {
            format!(
                "https://api.github.com/users/{org_or_user}/repos?per_page={per_page}&page={page}&sort=updated"
            )
        } else {
            format!(
                "https://api.github.com/orgs/{org_or_user}/repos?per_page={per_page}&page={page}&sort=updated"
            )
        };

        let resp = client
            .get(&url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .send()
            .map_err(|e| ScanError::ScanFailed(format!("GitHub API request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().unwrap_or_default();
            return Err(ScanError::ScanFailed(format!(
                "GitHub API error {status}: {body}"
            )));
        }

        let body = resp
            .text()
            .map_err(|e| ScanError::ScanFailed(format!("Failed to read response: {e}")))?;

        let repos: Vec<serde_json::Value> = serde_json::from_str(&body)
            .map_err(|e| ScanError::ScanFailed(format!("Failed to parse repos JSON: {e}")))?;

        if repos.is_empty() {
            break;
        }

        for repo in &repos {
            let fork = repo["fork"].as_bool().unwrap_or(false);
            let archived = repo["archived"].as_bool().unwrap_or(false);

            if skip_forks && fork {
                continue;
            }
            if skip_archived && archived {
                continue;
            }

            let full_name = repo["full_name"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let clone_url = repo["clone_url"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let default_branch = repo["default_branch"]
                .as_str()
                .unwrap_or("main")
                .to_string();

            if full_name.is_empty() || clone_url.is_empty() {
                continue;
            }

            all_repos.push(GitHubRepo {
                full_name,
                clone_url,
                fork,
                archived,
                default_branch,
            });

            if max_repos > 0 && all_repos.len() >= max_repos as usize {
                return Ok(all_repos);
            }
        }

        if repos.len() < per_page as usize {
            break;
        }
        page += 1;
    }

    Ok(all_repos)
}

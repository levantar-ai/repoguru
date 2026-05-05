use std::fmt;
use std::thread;
use std::time::Duration;

use reqwest::blocking::Client;
use reqwest::header::{self, HeaderMap, HeaderValue};
use serde::de::DeserializeOwned;
use serde::Deserialize;

use crate::github::types::*;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum GitHubError {
    /// 401 — bad credentials
    AuthFailure(String),
    /// 403 — rate limit exhausted
    RateLimit(String),
    /// 404 — resource not found (soft; callers may skip)
    NotFound(String),
    /// Network / deserialization / other
    Other(String),
}

impl fmt::Display for GitHubError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AuthFailure(m) => write!(f, "GitHub auth failure: {m}"),
            Self::RateLimit(m) => write!(f, "GitHub rate limit: {m}"),
            Self::NotFound(m) => write!(f, "GitHub 404: {m}"),
            Self::Other(m) => write!(f, "GitHub error: {m}"),
        }
    }
}

impl std::error::Error for GitHubError {}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

struct GitHubClient {
    http: Client,
    token: Option<String>,
    base_url: String,
}

impl GitHubClient {
    fn new(token: Option<String>, base_url: Option<&str>) -> Result<Self, GitHubError> {
        let mut headers = HeaderMap::new();
        headers.insert(
            header::ACCEPT,
            HeaderValue::from_static("application/vnd.github.v3+json"),
        );
        let http = Client::builder()
            .user_agent("repoanalyze/0.1")
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| GitHubError::Other(format!("failed to build HTTP client: {e}")))?;

        Ok(Self {
            http,
            token,
            base_url: base_url
                .unwrap_or("https://api.github.com")
                .trim_end_matches('/')
                .to_string(),
        })
    }

    /// Perform a GET request and deserialise the JSON response.
    fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, GitHubError> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.http.get(&url);
        if let Some(tok) = &self.token {
            req = req.header(header::AUTHORIZATION, format!("Bearer {tok}"));
        }

        let resp = req.send().map_err(|e| GitHubError::Other(e.to_string()))?;

        let status = resp.status();
        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(GitHubError::NotFound(url));
        }
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GitHubError::AuthFailure(
                resp.text().unwrap_or_default(),
            ));
        }
        if status == reqwest::StatusCode::FORBIDDEN {
            let body = resp.text().unwrap_or_default();
            return Err(GitHubError::RateLimit(body));
        }

        if !status.is_success() {
            let body = resp.text().unwrap_or_default();
            return Err(GitHubError::Other(format!("HTTP {status}: {body}")));
        }

        let body = resp.text().map_err(|e| GitHubError::Other(e.to_string()))?;
        serde_json::from_str(&body)
            .map_err(|e| GitHubError::Other(format!("JSON parse error on {url}: {e}")))
    }

    /// GET with retry for endpoints that return 202 (stats computing).
    fn get_with_retry<T: DeserializeOwned>(&self, path: &str) -> Result<T, GitHubError> {
        let url = format!("{}{}", self.base_url, path);

        for attempt in 0..5 {
            let mut req = self.http.get(&url);
            if let Some(tok) = &self.token {
                req = req.header(header::AUTHORIZATION, format!("Bearer {tok}"));
            }

            let resp = req.send().map_err(|e| GitHubError::Other(e.to_string()))?;
            let status = resp.status();

            if status == reqwest::StatusCode::ACCEPTED {
                if attempt < 4 {
                    thread::sleep(Duration::from_secs(2));
                    continue;
                }
                return Err(GitHubError::Other(format!(
                    "endpoint {url} still computing after 5 retries"
                )));
            }

            if status == reqwest::StatusCode::NOT_FOUND {
                return Err(GitHubError::NotFound(url));
            }
            if status == reqwest::StatusCode::UNAUTHORIZED {
                return Err(GitHubError::AuthFailure(
                    resp.text().unwrap_or_default(),
                ));
            }
            if status == reqwest::StatusCode::FORBIDDEN {
                let body = resp.text().unwrap_or_default();
                return Err(GitHubError::RateLimit(body));
            }
            if !status.is_success() {
                let body = resp.text().unwrap_or_default();
                return Err(GitHubError::Other(format!("HTTP {status}: {body}")));
            }

            let body = resp.text().map_err(|e| GitHubError::Other(e.to_string()))?;
            return serde_json::from_str(&body)
                .map_err(|e| GitHubError::Other(format!("JSON parse error on {url}: {e}")));
        }

        Err(GitHubError::Other(format!(
            "exhausted retries for {url}"
        )))
    }
}

// ---------------------------------------------------------------------------
// GitHub API response shapes (internal — differ from our output types)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct ApiRepo {
    full_name: String,
    description: Option<String>,
    stargazers_count: u64,
    forks_count: u64,
    open_issues_count: u64,
    subscribers_count: u64,
    license: Option<ApiLicense>,
    topics: Option<Vec<String>>,
    archived: bool,
    default_branch: String,
    created_at: String,
    updated_at: String,
    pushed_at: String,
    size: u64,
    html_url: String,
    fork: bool,
    has_wiki: bool,
    has_pages: bool,
    has_discussions: Option<bool>,
    visibility: Option<String>,
}

#[derive(Deserialize)]
struct ApiLicense {
    spdx_id: Option<String>,
}

#[derive(Deserialize)]
struct ApiPullRequest {
    number: u64,
    title: String,
    state: String,
    user: ApiUser,
    created_at: String,
    merged_at: Option<String>,
    labels: Vec<ApiLabel>,
    draft: Option<bool>,
}

#[derive(Deserialize)]
struct ApiIssue {
    number: u64,
    title: String,
    state: String,
    user: ApiUser,
    created_at: String,
    labels: Vec<ApiLabel>,
    pull_request: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct ApiUser {
    login: String,
}

#[derive(Deserialize)]
struct ApiLabel {
    name: String,
}

#[derive(Deserialize)]
struct ApiRelease {
    tag_name: String,
    name: Option<String>,
    published_at: Option<String>,
    prerelease: bool,
    draft: bool,
    author: ApiUser,
    body: Option<String>,
}

#[derive(Deserialize)]
struct ApiContributor {
    login: String,
    contributions: u64,
    avatar_url: String,
    html_url: String,
}

#[derive(Deserialize)]
struct ApiWorkflowsResponse {
    workflows: Vec<ApiWorkflow>,
}

#[derive(Deserialize)]
struct ApiWorkflow {
    name: String,
    state: String,
    path: String,
}

#[derive(Deserialize)]
struct ApiRunsResponse {
    workflow_runs: Vec<ApiRun>,
}

#[derive(Deserialize)]
struct ApiRun {
    name: Option<String>,
    status: String,
    conclusion: Option<String>,
    created_at: String,
    head_branch: Option<String>,
    run_number: u64,
}

#[derive(Deserialize)]
struct ApiBranchProtection {
    enforce_admins: Option<ApiEnabled>,
    required_pull_request_reviews: Option<ApiRequiredReviews>,
    required_status_checks: Option<ApiStatusChecks>,
    required_linear_history: Option<ApiEnabled>,
    allow_force_pushes: Option<ApiEnabled>,
    allow_deletions: Option<ApiEnabled>,
}

#[derive(Deserialize)]
struct ApiEnabled {
    enabled: bool,
}

#[derive(Deserialize)]
struct ApiRequiredReviews {
    required_approving_review_count: Option<u32>,
    dismiss_stale_reviews: Option<bool>,
    require_code_owner_reviews: Option<bool>,
}

#[derive(Deserialize)]
struct ApiStatusChecks {
    contexts: Vec<String>,
}

#[derive(Deserialize)]
struct ApiDependabotAlert {
    number: u64,
    state: String,
    security_advisory: Option<ApiSecurityAdvisory>,
    security_vulnerability: Option<ApiSecurityVulnerability>,
    created_at: String,
}

#[derive(Deserialize)]
struct ApiSecurityAdvisory {
    severity: Option<String>,
    summary: Option<String>,
}

#[derive(Deserialize)]
struct ApiSecurityVulnerability {
    package: Option<ApiPackage>,
}

#[derive(Deserialize)]
struct ApiPackage {
    name: Option<String>,
    ecosystem: Option<String>,
}

#[derive(Deserialize)]
struct ApiCommunityProfile {
    health_percentage: u32,
    files: ApiCommunityFiles,
}

#[derive(Deserialize)]
struct ApiCommunityFiles {
    code_of_conduct: Option<serde_json::Value>,
    contributing: Option<serde_json::Value>,
    issue_template: Option<serde_json::Value>,
    pull_request_template: Option<serde_json::Value>,
    readme: Option<serde_json::Value>,
    license: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

fn convert_pr(api: &ApiPullRequest) -> PullRequest {
    PullRequest {
        number: api.number,
        title: api.title.clone(),
        state: api.state.clone(),
        user: api.user.login.clone(),
        created_at: api.created_at.clone(),
        merged_at: api.merged_at.clone(),
        labels: api.labels.iter().map(|l| l.name.clone()).collect(),
        draft: api.draft.unwrap_or(false),
    }
}

fn convert_issue(api: &ApiIssue) -> Issue {
    Issue {
        number: api.number,
        title: api.title.clone(),
        state: api.state.clone(),
        user: api.user.login.clone(),
        created_at: api.created_at.clone(),
        labels: api.labels.iter().map(|l| l.name.clone()).collect(),
    }
}

/// Compute average merge time in hours from a list of merged PRs.
fn avg_merge_time(prs: &[ApiPullRequest]) -> Option<f64> {
    let merged: Vec<_> = prs
        .iter()
        .filter_map(|pr| {
            let merged_at = pr.merged_at.as_deref()?;
            let created = parse_iso8601(pr.created_at.as_str())?;
            let merged = parse_iso8601(merged_at)?;
            let diff = merged.saturating_sub(created);
            Some(diff as f64 / 3600.0)
        })
        .collect();

    if merged.is_empty() {
        return None;
    }
    Some(merged.iter().sum::<f64>() / merged.len() as f64)
}

/// Minimal ISO-8601 timestamp parser — returns epoch seconds.
/// Handles `2024-01-15T12:30:00Z` style strings.
fn parse_iso8601(s: &str) -> Option<u64> {
    // Strip trailing Z or +00:00
    let s = s.trim_end_matches('Z').trim_end_matches("+00:00");
    let (date, time) = s.split_once('T')?;
    let mut date_parts = date.split('-');
    let year: u64 = date_parts.next()?.parse().ok()?;
    let month: u64 = date_parts.next()?.parse().ok()?;
    let day: u64 = date_parts.next()?.parse().ok()?;

    let mut time_parts = time.split(':');
    let hour: u64 = time_parts.next()?.parse().ok()?;
    let min: u64 = time_parts.next()?.parse().ok()?;
    let sec: u64 = time_parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);

    // Rough epoch calculation (ignoring leap seconds, good enough for diffs)
    fn days_in_year(y: u64) -> u64 {
        if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
            366
        } else {
            365
        }
    }
    fn days_in_month(y: u64, m: u64) -> u64 {
        match m {
            1 => 31,
            2 => {
                if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) {
                    29
                } else {
                    28
                }
            }
            3 => 31,
            4 => 30,
            5 => 31,
            6 => 30,
            7 => 31,
            8 => 31,
            9 => 30,
            10 => 31,
            11 => 30,
            12 => 31,
            _ => 30,
        }
    }

    let mut days: u64 = 0;
    for y in 1970..year {
        days += days_in_year(y);
    }
    for m in 1..month {
        days += days_in_month(year, m);
    }
    days += day - 1;

    Some(days * 86400 + hour * 3600 + min * 60 + sec)
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Fetch GitHub enrichment data for `owner/repo`.
///
/// Each section is fetched independently; a 404 on one section does not fail
/// the whole enrichment.  Only hard auth failures (401) or network errors
/// propagate.
pub fn enrich(
    owner: &str,
    repo: &str,
    token: Option<&str>,
    base_url: Option<&str>,
) -> Result<GitHubEnrichment, GitHubError> {
    let client = GitHubClient::new(token.map(String::from), base_url)?;
    let prefix = format!("/repos/{owner}/{repo}");
    let mut out = GitHubEnrichment::default();

    // 1. Repo metadata
    eprintln!("[github] fetching repository metadata...");
    let api_repo: ApiRepo = client.get(&prefix)?;
    let default_branch = api_repo.default_branch.clone();
    out.meta = Some(RepoMeta {
        full_name: api_repo.full_name,
        description: api_repo.description,
        stars: api_repo.stargazers_count,
        forks: api_repo.forks_count,
        open_issues: api_repo.open_issues_count,
        watchers: api_repo.subscribers_count,
        license: api_repo.license.and_then(|l| l.spdx_id),
        topics: api_repo.topics.unwrap_or_default(),
        archived: api_repo.archived,
        default_branch: default_branch.clone(),
        created_at: api_repo.created_at,
        updated_at: api_repo.updated_at,
        pushed_at: api_repo.pushed_at,
        size_kb: api_repo.size,
        html_url: api_repo.html_url,
        is_fork: api_repo.fork,
        has_wiki: api_repo.has_wiki,
        has_pages: api_repo.has_pages,
        has_discussions: api_repo.has_discussions.unwrap_or(false),
        visibility: api_repo.visibility.unwrap_or_else(|| "public".into()),
    });

    // 2. Open PRs
    eprintln!("[github] fetching pull requests...");
    let open_prs: Vec<ApiPullRequest> = soft_get(
        &client,
        &format!("{prefix}/pulls?state=open&per_page=30&sort=updated"),
    );

    // 3. Recently merged PRs
    let closed_prs: Vec<ApiPullRequest> = soft_get(
        &client,
        &format!("{prefix}/pulls?state=closed&per_page=30&sort=updated&direction=desc"),
    );
    let merged_prs: Vec<&ApiPullRequest> = closed_prs
        .iter()
        .filter(|pr| pr.merged_at.is_some())
        .collect();

    out.pull_requests = Some(PrStats {
        open_count: open_prs.len() as u64,
        open_prs: open_prs.iter().map(convert_pr).collect(),
        recently_merged: merged_prs.iter().map(|pr| convert_pr(pr)).collect(),
        avg_merge_time_hours: avg_merge_time(&closed_prs),
    });

    // 4. Open issues (filter out PRs)
    eprintln!("[github] fetching issues...");
    let open_issues: Vec<ApiIssue> = soft_get(
        &client,
        &format!("{prefix}/issues?state=open&per_page=30&sort=updated"),
    );
    let open_issues: Vec<_> = open_issues
        .into_iter()
        .filter(|i| i.pull_request.is_none())
        .collect();

    // 5. Recently closed issues
    let closed_issues: Vec<ApiIssue> = soft_get(
        &client,
        &format!("{prefix}/issues?state=closed&per_page=10&sort=updated"),
    );
    let closed_issues: Vec<_> = closed_issues
        .into_iter()
        .filter(|i| i.pull_request.is_none())
        .collect();

    let mut all_issues: Vec<Issue> = open_issues.iter().map(convert_issue).collect();
    all_issues.extend(closed_issues.iter().map(convert_issue));

    // Use repo metadata for total open issues (more accurate than paginated fetch)
    let meta_open_issues = out.meta.as_ref().map(|m| m.open_issues).unwrap_or(0);
    let open_pr_count = out.pull_requests.as_ref().map(|p| p.open_count).unwrap_or(0);
    let real_open_issues = if meta_open_issues > open_pr_count {
        meta_open_issues - open_pr_count
    } else {
        open_issues.len() as u64
    };

    out.issues = Some(IssueStats {
        open_count: real_open_issues,
        closed_count: closed_issues.len() as u64,
        recent_issues: all_issues,
    });

    // 6. Releases
    eprintln!("[github] fetching releases...");
    let api_releases: Vec<ApiRelease> =
        soft_get(&client, &format!("{prefix}/releases?per_page=20"));
    out.releases = api_releases
        .into_iter()
        .map(|r| Release {
            tag_name: r.tag_name,
            name: r.name,
            published_at: r.published_at,
            prerelease: r.prerelease,
            draft: r.draft,
            author: r.author.login,
            body_length: r.body.as_deref().map_or(0, |b| b.len()),
        })
        .collect();

    // 7. Contributors
    eprintln!("[github] fetching contributors...");
    let api_contribs: Vec<ApiContributor> =
        soft_get_retry(&client, &format!("{prefix}/contributors?per_page=50"));
    out.contributors = api_contribs
        .into_iter()
        .map(|c| Contributor {
            login: c.login,
            contributions: c.contributions,
            avatar_url: c.avatar_url,
            html_url: c.html_url,
        })
        .collect();

    // 8. CI workflows
    eprintln!("[github] fetching CI workflows...");
    let workflows: Option<ApiWorkflowsResponse> =
        soft_get_opt(&client, &format!("{prefix}/actions/workflows"));
    out.ci_workflows = workflows
        .map(|w| {
            w.workflows
                .into_iter()
                .map(|wf| CiWorkflow {
                    name: wf.name,
                    state: wf.state,
                    path: wf.path,
                })
                .collect()
        })
        .unwrap_or_default();

    // 9. Recent CI runs
    let runs: Option<ApiRunsResponse> =
        soft_get_opt(&client, &format!("{prefix}/actions/runs?per_page=10"));
    out.recent_runs = runs
        .map(|r| {
            r.workflow_runs
                .into_iter()
                .map(|run| CiRun {
                    workflow_name: run.name.unwrap_or_default(),
                    status: run.status,
                    conclusion: run.conclusion,
                    created_at: run.created_at,
                    head_branch: run.head_branch.unwrap_or_default(),
                    run_number: run.run_number,
                })
                .collect()
        })
        .unwrap_or_default();

    // 10. Branch protection
    eprintln!("[github] fetching branch protection...");
    let protection: Option<ApiBranchProtection> = soft_get_opt(
        &client,
        &format!("{prefix}/branches/{default_branch}/protection"),
    );
    out.branch_protection = protection.map(|bp| BranchProtection {
        enforce_admins: bp.enforce_admins.map_or(false, |e| e.enabled),
        required_reviews: bp
            .required_pull_request_reviews
            .as_ref()
            .and_then(|r| r.required_approving_review_count),
        dismiss_stale_reviews: bp
            .required_pull_request_reviews
            .as_ref()
            .and_then(|r| r.dismiss_stale_reviews)
            .unwrap_or(false),
        require_code_owner_reviews: bp
            .required_pull_request_reviews
            .as_ref()
            .and_then(|r| r.require_code_owner_reviews)
            .unwrap_or(false),
        required_status_checks: bp
            .required_status_checks
            .map_or_else(Vec::new, |sc| sc.contexts),
        require_linear_history: bp.required_linear_history.map_or(false, |e| e.enabled),
        allow_force_pushes: bp.allow_force_pushes.map_or(false, |e| e.enabled),
        allow_deletions: bp.allow_deletions.map_or(false, |e| e.enabled),
    });

    // 11. Dependabot alerts
    eprintln!("[github] fetching dependabot alerts...");
    let alerts: Vec<ApiDependabotAlert> = soft_get(
        &client,
        &format!("{prefix}/dependabot/alerts?state=open&per_page=30"),
    );
    out.dependabot_alerts = alerts
        .into_iter()
        .map(|a| {
            let (pkg_name, pkg_eco) = a
                .security_vulnerability
                .and_then(|v| {
                    v.package.map(|p| {
                        (
                            p.name.unwrap_or_default(),
                            p.ecosystem.unwrap_or_default(),
                        )
                    })
                })
                .unwrap_or_default();
            DependabotAlert {
                number: a.number,
                state: a.state,
                severity: a
                    .security_advisory
                    .as_ref()
                    .and_then(|sa| sa.severity.clone())
                    .unwrap_or_default(),
                summary: a
                    .security_advisory
                    .and_then(|sa| sa.summary)
                    .unwrap_or_default(),
                package_name: pkg_name,
                package_ecosystem: pkg_eco,
                created_at: a.created_at,
            }
        })
        .collect();

    // 12. Community profile
    eprintln!("[github] fetching community profile...");
    let community: Option<ApiCommunityProfile> =
        soft_get_opt(&client, &format!("{prefix}/community/profile"));
    out.community = community.map(|c| CommunityProfile {
        health_percentage: c.health_percentage,
        has_code_of_conduct: c.files.code_of_conduct.is_some(),
        has_contributing: c.files.contributing.is_some(),
        has_issue_template: c.files.issue_template.is_some(),
        has_pull_request_template: c.files.pull_request_template.is_some(),
        has_readme: c.files.readme.is_some(),
        has_license: c.files.license.is_some(),
    });

    eprintln!("[github] enrichment complete.");
    Ok(out)
}

// ---------------------------------------------------------------------------
// Soft-fetch helpers — 404/403 returns empty, only 401 propagates
// ---------------------------------------------------------------------------

/// Fetch a list endpoint; on 404/403 return an empty vec.
fn soft_get<T: DeserializeOwned>(client: &GitHubClient, path: &str) -> Vec<T> {
    match client.get::<Vec<T>>(path) {
        Ok(v) => v,
        Err(GitHubError::NotFound(_)) => Vec::new(),
        Err(GitHubError::RateLimit(m)) => {
            eprintln!("[github] rate limited on {path}: {m}");
            Vec::new()
        }
        Err(e) => {
            eprintln!("[github] warning: {e}");
            Vec::new()
        }
    }
}

/// Fetch a list endpoint with 202-retry support; on 404/403 return empty vec.
fn soft_get_retry<T: DeserializeOwned>(client: &GitHubClient, path: &str) -> Vec<T> {
    match client.get_with_retry::<Vec<T>>(path) {
        Ok(v) => v,
        Err(GitHubError::NotFound(_)) => Vec::new(),
        Err(GitHubError::RateLimit(m)) => {
            eprintln!("[github] rate limited on {path}: {m}");
            Vec::new()
        }
        Err(e) => {
            eprintln!("[github] warning: {e}");
            Vec::new()
        }
    }
}

/// Fetch a single-object endpoint; on 404/403 return None.
fn soft_get_opt<T: DeserializeOwned>(client: &GitHubClient, path: &str) -> Option<T> {
    match client.get::<T>(path) {
        Ok(v) => Some(v),
        Err(GitHubError::NotFound(_)) => None,
        Err(GitHubError::RateLimit(m)) => {
            eprintln!("[github] rate limited on {path}: {m}");
            None
        }
        Err(e) => {
            eprintln!("[github] warning: {e}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_iso8601() {
        let ts = parse_iso8601("2024-01-15T12:30:00Z").unwrap();
        assert!(ts > 0);
        // Same timestamp with +00:00 suffix should give same result
        let ts2 = parse_iso8601("2024-01-15T12:30:00+00:00").unwrap();
        assert_eq!(ts, ts2);
    }

    #[test]
    fn test_avg_merge_time_empty() {
        assert!(avg_merge_time(&[]).is_none());
    }
}

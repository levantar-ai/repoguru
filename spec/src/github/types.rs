use serde::{Deserialize, Serialize};

/// Aggregated GitHub enrichment data for a repository.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GitHubEnrichment {
    pub meta: Option<RepoMeta>,
    pub pull_requests: Option<PrStats>,
    pub issues: Option<IssueStats>,
    pub releases: Vec<Release>,
    pub contributors: Vec<Contributor>,
    pub ci_workflows: Vec<CiWorkflow>,
    pub recent_runs: Vec<CiRun>,
    pub branch_protection: Option<BranchProtection>,
    pub dependabot_alerts: Vec<DependabotAlert>,
    pub community: Option<CommunityProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RepoMeta {
    pub full_name: String,
    pub description: Option<String>,
    pub stars: u64,
    pub forks: u64,
    pub open_issues: u64,
    pub watchers: u64,
    pub license: Option<String>,
    pub topics: Vec<String>,
    pub archived: bool,
    pub default_branch: String,
    pub created_at: String,
    pub updated_at: String,
    pub pushed_at: String,
    pub size_kb: u64,
    pub html_url: String,
    pub is_fork: bool,
    pub has_wiki: bool,
    pub has_pages: bool,
    pub has_discussions: bool,
    pub visibility: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrStats {
    pub open_count: u64,
    pub open_prs: Vec<PullRequest>,
    pub recently_merged: Vec<PullRequest>,
    pub avg_merge_time_hours: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub user: String,
    pub created_at: String,
    pub merged_at: Option<String>,
    pub labels: Vec<String>,
    pub draft: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct IssueStats {
    pub open_count: u64,
    pub closed_count: u64,
    pub recent_issues: Vec<Issue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Issue {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub user: String,
    pub created_at: String,
    pub labels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Release {
    pub tag_name: String,
    pub name: Option<String>,
    pub published_at: Option<String>,
    pub prerelease: bool,
    pub draft: bool,
    pub author: String,
    pub body_length: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Contributor {
    pub login: String,
    pub contributions: u64,
    pub avatar_url: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CiWorkflow {
    pub name: String,
    pub state: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CiRun {
    pub workflow_name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub created_at: String,
    pub head_branch: String,
    pub run_number: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BranchProtection {
    pub enforce_admins: bool,
    pub required_reviews: Option<u32>,
    pub dismiss_stale_reviews: bool,
    pub require_code_owner_reviews: bool,
    pub required_status_checks: Vec<String>,
    pub require_linear_history: bool,
    pub allow_force_pushes: bool,
    pub allow_deletions: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DependabotAlert {
    pub number: u64,
    pub state: String,
    pub severity: String,
    pub summary: String,
    pub package_name: String,
    pub package_ecosystem: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CommunityProfile {
    pub health_percentage: u32,
    pub has_code_of_conduct: bool,
    pub has_contributing: bool,
    pub has_issue_template: bool,
    pub has_pull_request_template: bool,
    pub has_readme: bool,
    pub has_license: bool,
}

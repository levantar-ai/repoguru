pub mod client;
pub mod remote;
pub mod types;

pub use client::enrich;
pub use remote::parse_github_remote;
pub use types::GitHubEnrichment;

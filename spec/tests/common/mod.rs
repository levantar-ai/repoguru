// Shared test helpers for RepoAnalyze integration tests.

pub mod fixture;

use assert_cmd::Command;

/// Create a Command for the repoanalyze binary.
pub fn cmd() -> Command {
    Command::cargo_bin("repoanalyze").expect("binary should exist")
}

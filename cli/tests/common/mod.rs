// Shared test helpers for RepoAnalyze integration tests.
//
// Each `tests/phaseN_*.rs` is its own crate, so any helper not referenced
// by *that specific* phase reads as dead code under `-D warnings`. The
// helpers ARE used — just not by every phase. Allow.
#![allow(dead_code)]

pub mod fixture;

use assert_cmd::Command;

/// Create a Command for the repoanalyze binary.
#[allow(deprecated)]
pub fn cmd() -> Command {
    Command::cargo_bin("repoanalyze").expect("binary should exist")
}

mod common;

fn run_pipeline_with_report(repo_path: &std::path::Path, report_on: bool) -> tempfile::TempDir {
    let out = tempfile::tempdir().unwrap();
    let args = repoanalyze::cli::ScanArgs {
        repo: repo_path.to_path_buf(),
        out: out.path().to_path_buf(),
        threads: None,
        merge_policy: repoanalyze::cli::MergePolicy::FirstParent,
        renames: repoanalyze::cli::OnOff::Off,
        copies: repoanalyze::cli::OnOff::Off,
        rename_threshold: 50,
        include_remotes: repoanalyze::cli::OnOff::Off,
        max_top: 50,
        format: repoanalyze::cli::OutputFormat::Raw,
        report: if report_on {
            repoanalyze::cli::OnOff::On
        } else {
            repoanalyze::cli::OnOff::Off
        },
        telemetry: repoanalyze::cli::OnOff::Off,
        since: None,
        until: None,
        max_diff_files: 1000,
        merge_diff_limit: 100,
        worker_cache_mb: 128,
        sizer_cache_mb: 64,
        sizer_chunk_size: 10_000,
        channel_capacity: 256,
        max_commits: 0,
    };
    repoanalyze::pipeline::run_pipeline(&args).unwrap();
    out
}

#[test]
fn phase10_test_report_files_exist() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_with_report(&repo_path, true);

    assert!(out.path().join("report/index.html").exists());
    assert!(out.path().join("report/data/summary.json").exists());
    assert!(out.path().join("report/data/timelines.json").exists());
    assert!(out.path().join("report/data/authors.json").exists());
    assert!(out.path().join("report/data/hotspots.json").exists());
}

#[test]
fn phase10_test_html_valid() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_with_report(&repo_path, true);

    let html = std::fs::read_to_string(out.path().join("report/index.html")).unwrap();
    assert!(html.contains("<html"), "should contain <html> tag");
    assert!(html.contains("</html>"), "should contain closing </html>");
    assert!(
        html.contains("echarts"),
        "should contain embedded ECharts JS"
    );
    assert!(html.contains("RepoAnalyze"), "should contain title");
    assert!(html.contains("<script>"), "should have script tags");
}

#[test]
fn phase10_test_data_json_valid() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_with_report(&repo_path, true);

    // Each data file should be valid JSON
    for fname in [
        "summary.json",
        "timelines.json",
        "authors.json",
        "hotspots.json",
    ] {
        let path = out.path().join(format!("report/data/{fname}"));
        let content =
            std::fs::read_to_string(&path).unwrap_or_else(|_| panic!("{fname} should exist"));
        let _: serde_json::Value = serde_json::from_str(&content)
            .unwrap_or_else(|_| panic!("{fname} should be valid JSON"));
    }
}

#[test]
fn phase10_test_paths_escaped_in_html() {
    use repoanalyze::report::html::escape_html;

    // Test the escape function directly
    let malicious = "<script>alert('xss')</script>";
    let escaped = escape_html(malicious);
    assert!(!escaped.contains('<'), "< should be escaped");
    assert!(!escaped.contains('>'), "> should be escaped");
    assert!(escaped.contains("&lt;script&gt;"), "should escape properly");
    assert!(escaped.contains("&#39;"), "should escape single quotes");
}

#[test]
fn phase10_test_report_off_flag() {
    let tmp = tempfile::tempdir().unwrap();
    let repo_path = common::fixture::create_simple_repo(tmp.path()).unwrap();
    let out = run_pipeline_with_report(&repo_path, false);

    assert!(
        !out.path().join("report").exists(),
        "report dir should not exist with --report off"
    );
}

use std::path::PathBuf;

use clap::{Parser, Subcommand, ValueEnum};

/// RepoAnalyze — Pure Rust git repository analyzer
#[derive(Debug, Parser)]
#[command(name = "repoanalyze", version, about)]
pub struct Cli {
    /// Directory for cached repo clones (used when --repo is a URL)
    #[arg(long, global = true, env = "REPOANALYZE_CLONE_DIR")]
    pub clone_dir: Option<PathBuf>,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Scan a git repository and produce analytics
    Scan(ScanArgs),
    /// Detect technologies, frameworks, and cloud services in a repository
    DetectTech(DetectTechArgs),
    /// Score a repository's health across 8 categories
    Score(ScoreArgs),
    /// Generate a CycloneDX SBOM from detected dependencies
    Sbom(SbomArgs),
    /// Compare two repositories side-by-side
    Compare(CompareArgs),
    /// Evaluate a policy preset against a repository
    Policy(PolicyArgs),
    /// Start a gRPC server for programmatic access
    Serve(ServeArgs),
}

/// Arguments for the `scan` subcommand (§3.2).
#[derive(Debug, Parser)]
pub struct ScanArgs {
    /// Path to git repository (worktree root, bare repo, or .git directory)
    #[arg(long)]
    pub repo: PathBuf,

    /// Output directory for results
    #[arg(long)]
    pub out: PathBuf,

    /// Number of worker threads (default: logical cores)
    #[arg(long)]
    pub threads: Option<usize>,

    /// Merge policy for merge commits
    #[arg(long, default_value = "first-parent")]
    pub merge_policy: MergePolicy,

    /// Enable/disable rename detection
    #[arg(long, default_value = "on")]
    pub renames: OnOff,

    /// Enable/disable copy detection
    #[arg(long, default_value = "on")]
    pub copies: OnOff,

    /// Rename similarity threshold (0..100)
    #[arg(long, default_value_t = 50, value_parser = clap::value_parser!(u8).range(0..=100))]
    pub rename_threshold: u8,

    /// Include remote refs in scan
    #[arg(long, default_value = "on")]
    pub include_remotes: OnOff,

    /// Maximum number of top-N entries in reports
    #[arg(long, default_value_t = 50)]
    pub max_top: usize,

    /// Output format
    #[arg(long, default_value = "raw")]
    pub format: OutputFormat,

    /// Generate HTML report
    #[arg(long, default_value = "on")]
    pub report: OnOff,

    /// Enable performance telemetry output
    #[arg(long, default_value = "on")]
    pub telemetry: OnOff,

    /// Only include commits after this rev or ISO date
    #[arg(long)]
    pub since: Option<String>,

    /// Only include commits before this rev or ISO date
    #[arg(long)]
    pub until: Option<String>,

    /// Max file changes per commit before skipping line-level diff (memory safety)
    #[arg(long, default_value_t = 1000)]
    pub max_diff_files: usize,

    /// Max file changes for merge commits (merge diffs are redundant with parent commits)
    #[arg(long, default_value_t = 100)]
    pub merge_diff_limit: usize,

    /// Object cache size in MB for diff worker threads (higher = faster pack lookups)
    #[arg(long, default_value_t = 128)]
    pub worker_cache_mb: usize,

    /// Object cache size in MB for sizer rayon tasks
    #[arg(long, default_value_t = 64)]
    pub sizer_cache_mb: usize,

    /// Number of OIDs per rayon chunk in the sizer phase
    #[arg(long, default_value_t = 10_000)]
    pub sizer_chunk_size: usize,

    /// Bounded channel capacity for planner→worker and worker→aggregator queues
    #[arg(long, default_value_t = 256)]
    pub channel_capacity: usize,

    /// Verbose output — show detailed log lines above progress bars
    #[arg(short, long)]
    pub verbose: bool,

    /// GitHub API enrichment: on/off/auto (auto detects GitHub remotes)
    #[arg(long, default_value = "auto")]
    pub github: GitHubMode,

    /// GitHub personal access token
    #[arg(long, env = "GITHUB_TOKEN")]
    pub github_token: Option<String>,

    /// GitHub API base URL (for GitHub Enterprise)
    #[arg(long, default_value = "https://api.github.com")]
    pub github_api_url: String,
}

/// Arguments for the `detect-tech` subcommand.
#[derive(Debug, Parser)]
pub struct DetectTechArgs {
    /// Path to git repository (worktree root, bare repo, or .git directory)
    #[arg(long)]
    pub repo: PathBuf,

    /// Output format: json (machine-readable) or text (human-readable)
    #[arg(long, default_value = "text")]
    pub format: DetectTechFormat,

    /// Output path for HTML report (e.g. /tmp/tech-report.html)
    #[arg(long)]
    pub out: Option<PathBuf>,
}

/// Arguments for the `score` subcommand.
#[derive(Debug, Parser)]
pub struct ScoreArgs {
    /// Path to git repository
    #[arg(long)]
    pub repo: PathBuf,

    /// Output directory for results (writes score.json)
    #[arg(long)]
    pub out: PathBuf,

    /// Path to prior scan output (enriches scoring with git history metrics)
    #[arg(long)]
    pub scan_out: Option<PathBuf>,

    /// Output format: json or text
    #[arg(long, default_value = "json")]
    pub format: ScoreFormat,
}

/// Arguments for the `sbom` subcommand.
#[derive(Debug, Parser)]
pub struct SbomArgs {
    /// Path to git repository
    #[arg(long)]
    pub repo: PathBuf,

    /// Output directory for results (writes sbom.json)
    #[arg(long)]
    pub out: PathBuf,
}

/// Arguments for the `compare` subcommand.
#[derive(Debug, Parser)]
pub struct CompareArgs {
    /// Path to first git repository
    #[arg(long)]
    pub repo_a: PathBuf,

    /// Path to second git repository
    #[arg(long)]
    pub repo_b: PathBuf,

    /// Output directory for results (writes compare.json)
    #[arg(long)]
    pub out: PathBuf,
}

/// Arguments for the `policy` subcommand.
#[derive(Debug, Parser)]
pub struct PolicyArgs {
    /// Path to git repository
    #[arg(long)]
    pub repo: PathBuf,

    /// Output directory for results (writes policy.json)
    #[arg(long)]
    pub out: PathBuf,

    /// Policy preset: basic-hygiene, production-ready, or security-focused
    #[arg(long, default_value = "basic-hygiene")]
    pub preset: String,
}

/// Arguments for the `serve` subcommand.
#[derive(Debug, Parser)]
pub struct ServeArgs {
    /// gRPC listen address (default: [::1]:50051)
    #[arg(long, default_value = "[::1]:50051")]
    pub listen: String,
}

/// Output format for score command.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum ScoreFormat {
    Json,
    Text,
}

/// Output format for detect-tech.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum DetectTechFormat {
    Json,
    Text,
}

/// On/Off toggle for boolean-style CLI flags.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum OnOff {
    On,
    Off,
}

impl OnOff {
    pub fn is_on(self) -> bool {
        matches!(self, OnOff::On)
    }
}

/// GitHub enrichment mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum GitHubMode {
    /// Always fetch GitHub data
    On,
    /// Never fetch GitHub data
    Off,
    /// Detect GitHub remote and fetch if found
    Auto,
}

impl GitHubMode {
    pub fn should_try(self) -> bool {
        matches!(self, GitHubMode::On | GitHubMode::Auto)
    }
}

/// Merge policy for handling merge commits (§1.4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum MergePolicy {
    #[value(name = "first-parent")]
    FirstParent,
    #[value(name = "all-parents")]
    AllParents,
}

/// Output format (§3.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum OutputFormat {
    Raw,
    Sqlite,
}

/// Run the CLI. Parses arguments and dispatches to the appropriate command.
pub fn run() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let clone_dir = cli.clone_dir.unwrap_or_else(default_clone_dir);

    match cli.command {
        Commands::Scan(args) => run_scan(args, &clone_dir),
        Commands::DetectTech(args) => run_detect_tech(args, &clone_dir),
        Commands::Score(args) => run_score(args, &clone_dir),
        Commands::Sbom(args) => run_sbom(args, &clone_dir),
        Commands::Compare(args) => run_compare(args, &clone_dir),
        Commands::Policy(args) => run_policy(args, &clone_dir),
        Commands::Serve(args) => run_serve(args),
    }
}

/// Default clone cache directory: $HOME/.cache/repoanalyze/clones
fn default_clone_dir() -> PathBuf {
    dirs_next::cache_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("repoanalyze")
        .join("clones")
}

/// Resolve a --repo argument, cloning from URL if needed.
fn resolve_repo(repo: &PathBuf, clone_dir: &PathBuf) -> anyhow::Result<PathBuf> {
    Ok(crate::repo::clone::resolve_repo(repo.as_path(), clone_dir.as_path())?)
}

fn run_scan(mut args: ScanArgs, clone_dir: &PathBuf) -> anyhow::Result<()> {
    args.repo = resolve_repo(&args.repo, clone_dir)?;
    crate::pipeline::run_pipeline(&args)?;
    Ok(())
}

fn run_detect_tech(args: DetectTechArgs, clone_dir: &PathBuf) -> anyhow::Result<()> {
    let repo = resolve_repo(&args.repo, clone_dir)?;
    let result = crate::techdetect::run_detect_tech(&repo)?;

    match args.format {
        DetectTechFormat::Json => {
            let json = serde_json::to_string_pretty(&result)?;
            println!("{json}");
        }
        DetectTechFormat::Text => {
            print_detect_tech_text(&result);
        }
    }

    // Generate HTML report if --out is specified
    if let Some(out_path) = &args.out {
        let html_path = if out_path.is_dir() || !out_path.to_string_lossy().ends_with(".html") {
            std::fs::create_dir_all(out_path)?;
            out_path.join("tech-report.html")
        } else {
            out_path.clone()
        };
        crate::report::tech_html::generate_tech_report(&html_path, &result)?;
        eprintln!("\nHTML report written to: {}", html_path.display());
    }

    Ok(())
}

fn print_detect_tech_text(result: &crate::techdetect::types::TechDetectResult) {
    println!("=== Technology Detection Report ===\n");
    println!("Total files scanned: {}", result.total_files);
    println!("Manifest files analyzed: {}\n", result.manifest_files.len());

    // Languages
    if !result.languages.is_empty() {
        println!("--- Languages ---");
        let total: u64 = result.languages.values().sum();
        let mut langs: Vec<_> = result.languages.iter().collect();
        langs.sort_by(|a, b| b.1.cmp(a.1));
        for (lang, count) in &langs {
            let pct = **count as f64 / total as f64 * 100.0;
            println!("  {lang:<20} {count:>5} files ({pct:.1}%)");
        }
        println!();
    }

    // Cloud services
    print_cloud_section("AWS Services", &result.aws);
    print_cloud_section("Azure Services", &result.azure);
    print_cloud_section("GCP Services", &result.gcp);

    // Frameworks
    if !result.frameworks.is_empty() {
        println!("--- Frameworks ---");
        for f in &result.frameworks {
            let ver = f.version.as_deref().unwrap_or("");
            println!("  {} {ver} (via {}, {})", f.name, f.via, f.source);
        }
        println!();
    }

    // Databases
    if !result.databases.is_empty() {
        println!("--- Databases ---");
        for d in &result.databases {
            println!("  {} (via {}, {})", d.name, d.via, d.source);
        }
        println!();
    }

    // CI/CD
    if !result.cicd.is_empty() {
        println!("--- CI/CD ---");
        for c in &result.cicd {
            println!("  {} [{}] ({})", c.name, c.category, c.source);
        }
        println!();
    }

    // Testing
    if !result.testing.is_empty() {
        println!("--- Testing & Quality ---");
        for t in &result.testing {
            println!(
                "  {} [{}] (via {}, {})",
                t.name, t.category, t.via, t.source
            );
        }
        println!();
    }

    // Package counts
    let pkg_sections = [
        ("Python", result.python.len()),
        ("Node.js", result.node.len()),
        ("Go", result.go.len()),
        ("Java", result.java.len()),
        ("PHP", result.php.len()),
        ("Rust", result.rust.len()),
        ("Ruby", result.ruby.len()),
    ];
    let has_packages = pkg_sections.iter().any(|(_, c)| *c > 0);
    if has_packages {
        println!("--- Dependencies ---");
        for (name, count) in &pkg_sections {
            if *count > 0 {
                println!("  {name}: {count} packages");
            }
        }
        println!();
    }
}

fn run_score(args: ScoreArgs, clone_dir: &PathBuf) -> anyhow::Result<()> {
    let repo = resolve_repo(&args.repo, clone_dir)?;
    let result = crate::scoring::score_repo(&repo, args.scan_out.as_deref())?;
    std::fs::create_dir_all(&args.out)?;

    let json = serde_json::to_string_pretty(&result)?;
    let out_file = args.out.join("score.json");
    std::fs::write(&out_file, &json)?;

    match args.format {
        ScoreFormat::Json => println!("{json}"),
        ScoreFormat::Text => {
            println!("Repository Health Score: {}/100 ({})\n", result.overall_score, result.grade);
            for cat in &result.categories {
                println!("  {:<20} {:>3}/100 ({})", cat.label, cat.score, cat.grade);
            }
            if !result.strengths.is_empty() {
                println!("\nStrengths:");
                for s in &result.strengths { println!("  + {s}"); }
            }
            if !result.risks.is_empty() {
                println!("\nRisks:");
                for r in &result.risks { println!("  ! {r}"); }
            }
            if !result.next_steps.is_empty() {
                println!("\nNext steps:");
                for n in &result.next_steps { println!("  → {n}"); }
            }
        }
    }

    println!("\nScore written to: {}", out_file.display());
    Ok(())
}

fn run_sbom(args: SbomArgs, clone_dir: &PathBuf) -> anyhow::Result<()> {
    let repo = resolve_repo(&args.repo, clone_dir)?;
    let result = crate::sbom::generate_sbom(&repo)?;
    std::fs::create_dir_all(&args.out)?;

    let out_file = args.out.join("sbom.json");
    std::fs::write(&out_file, &result.content)?;

    println!("SBOM generated: {} components ({})", result.component_count, result.format);
    println!("Written to: {}", out_file.display());
    Ok(())
}

fn run_compare(args: CompareArgs, clone_dir: &PathBuf) -> anyhow::Result<()> {
    let repo_a = resolve_repo(&args.repo_a, clone_dir)?;
    let repo_b = resolve_repo(&args.repo_b, clone_dir)?;
    let result = crate::compare::compare(&repo_a, &repo_b, None, None)?;
    std::fs::create_dir_all(&args.out)?;

    println!("Repo A: {}/100 ({})  vs  Repo B: {}/100 ({})",
        result.report_card_a.overall_score, result.report_card_a.grade,
        result.report_card_b.overall_score, result.report_card_b.grade);
    println!("Winner: {} (delta: {:+})\n", result.winner, result.score_delta);

    for d in &result.deltas {
        println!("  {:<20} A={:>3}  B={:>3}  {:+>4}  ({})", d.category, d.score_a, d.score_b, d.delta, d.winner);
    }

    // Serialize for JSON output
    let output = serde_json::json!({
        "report_card_a": result.report_card_a,
        "report_card_b": result.report_card_b,
        "deltas": result.deltas.iter().map(|d| serde_json::json!({
            "category": d.category,
            "score_a": d.score_a,
            "score_b": d.score_b,
            "delta": d.delta,
            "winner": d.winner,
        })).collect::<Vec<_>>(),
        "winner": result.winner,
        "score_delta": result.score_delta,
    });
    let out_file = args.out.join("compare.json");
    std::fs::write(&out_file, serde_json::to_string_pretty(&output)?)?;
    println!("\nComparison written to: {}", out_file.display());
    Ok(())
}

fn run_policy(args: PolicyArgs, clone_dir: &PathBuf) -> anyhow::Result<()> {
    let repo = resolve_repo(&args.repo, clone_dir)?;
    let score = crate::scoring::score_repo(&repo, None)?;
    let evaluation = crate::policy::evaluate_preset(&args.preset, &score)
        .map_err(|e| anyhow::anyhow!(e))?;

    std::fs::create_dir_all(&args.out)?;

    let status = if evaluation.passed { "PASSED" } else { "FAILED" };
    println!("Policy '{}': {} ({} passed, {} failed)\n", args.preset, status, evaluation.pass_count, evaluation.fail_count);

    for r in &evaluation.results {
        let icon = if r.passed { "✓" } else { "✗" };
        println!("  {icon} [{}] {} — expected {}, got {}", r.rule.severity, r.rule.name, r.expected, r.actual);
    }

    let json = serde_json::to_string_pretty(&evaluation)?;
    let out_file = args.out.join("policy.json");
    std::fs::write(&out_file, &json)?;
    println!("\nPolicy evaluation written to: {}", out_file.display());
    Ok(())
}

fn run_serve(args: ServeArgs) -> anyhow::Result<()> {
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async {
        crate::grpc::server::run_server(&args.listen)
            .await
            .map_err(|e| anyhow::anyhow!("gRPC server error: {e}"))
    })
}

fn print_cloud_section(title: &str, services: &[crate::techdetect::types::DetectedCloudService]) {
    if services.is_empty() {
        return;
    }
    println!("--- {title} ---");
    for s in services {
        let pkg = s.sdk_package.as_deref().unwrap_or("");
        if pkg.is_empty() {
            println!("  {} (via {}, {})", s.service, s.via, s.source);
        } else {
            println!("  {} [{}] (via {}, {})", s.service, pkg, s.via, s.source);
        }
    }
    println!();
}

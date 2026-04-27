use std::path::PathBuf;

use clap::{Parser, Subcommand, ValueEnum};

/// RepoAnalyze — Pure Rust git repository analyzer
#[derive(Debug, Parser)]
#[command(name = "repoanalyze", version, about)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Debug, Subcommand)]
pub enum Commands {
    /// Scan a git repository and produce analytics
    Scan(ScanArgs),
    /// Detect technologies, frameworks, and cloud services in a repository
    DetectTech(DetectTechArgs),
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

/// Arguments for the `serve` subcommand.
#[derive(Debug, Parser)]
pub struct ServeArgs {
    /// gRPC listen address (default: [::1]:50051)
    #[arg(long, default_value = "[::1]:50051")]
    pub listen: String,
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

    match cli.command {
        Commands::Scan(args) => run_scan(args),
        Commands::DetectTech(args) => run_detect_tech(args),
        Commands::Serve(args) => run_serve(args),
    }
}

fn run_scan(args: ScanArgs) -> anyhow::Result<()> {
    crate::pipeline::run_pipeline(&args)?;
    Ok(())
}

fn run_detect_tech(args: DetectTechArgs) -> anyhow::Result<()> {
    let result = crate::techdetect::run_detect_tech(&args.repo)?;

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
        crate::report::tech_html::generate_tech_report(out_path, &result)?;
        println!("\nHTML report written to: {}", out_path.display());
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

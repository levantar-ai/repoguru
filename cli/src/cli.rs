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
    /// Score a repository on a Report Card (engineering, activity,
    /// maintainability, documentation, modernity). Emits JSON to
    /// stdout; intended for portfolio/report use.
    ReportCard(ReportCardArgs),
    /// Start a gRPC server for programmatic access
    Serve(ServeArgs),
}

/// Arguments for the `report-card` subcommand.
#[derive(Debug, Parser)]
pub struct ReportCardArgs {
    /// Path to git repository (worktree root)
    #[arg(long)]
    pub repo: PathBuf,

    /// Optional path to a tech-detect JSON output (skip re-running
    /// detect-tech if already produced upstream).
    #[arg(long)]
    pub tech_detect_json: Option<PathBuf>,
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

    /// Cap the revwalk at this many commits (0 = no cap). Lets a scan
    /// run in predictable time against shallow clones for portfolio
    /// analyses where only recent activity matters.
    #[arg(long, default_value_t = 0)]
    pub max_commits: usize,
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
        Commands::ReportCard(args) => run_report_card(args),
        Commands::Serve(args) => run_serve(args),
    }
}

fn run_scan(args: ScanArgs) -> anyhow::Result<()> {
    crate::pipeline::run_pipeline(&args)?;
    Ok(())
}

fn run_report_card(args: ReportCardArgs) -> anyhow::Result<()> {
    use serde_json::json;
    use std::fs;
    use std::path::Path;

    // Cheap signal probes against the worktree at HEAD. Each is a
    // boolean / count answerable from path existence + small reads.
    let repo = &args.repo;

    fn exists(p: &Path) -> bool { p.exists() }
    fn dir_count(p: &Path) -> usize {
        match fs::read_dir(p) {
            Ok(entries) => entries.filter_map(|e| e.ok()).count(),
            Err(_) => 0,
        }
    }
    fn read_size(p: &Path) -> u64 {
        fs::metadata(p).map(|m| m.len()).unwrap_or(0)
    }

    // Tech-detect — either run it or read pre-computed JSON.
    let td_value: serde_json::Value = if let Some(path) = &args.tech_detect_json {
        let raw = fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("read tech-detect JSON: {e}"))?;
        serde_json::from_str(&raw).map_err(|e| anyhow::anyhow!("parse tech-detect JSON: {e}"))?
    } else {
        let result = crate::techdetect::run_detect_tech(repo)?;
        serde_json::to_value(&result)?
    };

    let arr_len = |key: &str| -> usize {
        td_value.get(key)
            .and_then(|v| v.as_array())
            .map(|a| a.iter().filter(|x| !x.is_null()).count())
            .unwrap_or(0)
    };
    let has_cicd = arr_len("cicd") > 0;
    let has_tests = arr_len("testing") > 0;
    let has_framework = arr_len("frameworks") > 0;
    let has_db = arr_len("databases") > 0;
    let has_any_cloud = arr_len("aws") > 0 || arr_len("azure") > 0 || arr_len("gcp") > 0;

    // Documentation signals — pure filesystem.
    let readme_size = ["README.md", "README.rst", "README.txt", "README"]
        .iter()
        .map(|n| read_size(&repo.join(n)))
        .max()
        .unwrap_or(0);
    let has_readme = readme_size > 0;
    let has_changelog = exists(&repo.join("CHANGELOG.md")) || exists(&repo.join("CHANGELOG"));
    let has_contributing = exists(&repo.join("CONTRIBUTING.md"));
    let has_security = exists(&repo.join("SECURITY.md"));
    let has_license = exists(&repo.join("LICENSE")) || exists(&repo.join("LICENSE.md")) || exists(&repo.join("LICENCE"));
    let has_docs_dir = exists(&repo.join("docs")) && dir_count(&repo.join("docs")) > 0;

    // Supply-chain hygiene.
    let has_dependabot = exists(&repo.join(".github/dependabot.yml")) || exists(&repo.join(".github/dependabot.yaml"));
    let has_renovate = exists(&repo.join("renovate.json")) || exists(&repo.join(".renovaterc")) || exists(&repo.join(".renovaterc.json"));
    let has_codeowners = exists(&repo.join("CODEOWNERS")) || exists(&repo.join(".github/CODEOWNERS"));
    let has_lockfile = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml",
                        "Cargo.lock", "Gemfile.lock", "poetry.lock",
                        "composer.lock", "go.sum", "uv.lock"]
        .iter().any(|n| exists(&repo.join(n)));

    // AI tooling configs (the "is this team AI-augmented" signal).
    let claude_md = exists(&repo.join("CLAUDE.md"));
    let agents_md = exists(&repo.join("AGENTS.md"));
    let cursor_dir = exists(&repo.join(".cursor")) || exists(&repo.join(".cursorrules"));
    let copilot_instr = exists(&repo.join(".github/copilot-instructions.md"));
    let claude_dir = exists(&repo.join(".claude"));
    let aider_conf = exists(&repo.join(".aider.conf.yml"));

    // Categorical scoring — each 0-100, then average.
    fn pts(v: bool, p: u32) -> u32 { if v { p } else { 0 } }

    let engineering = pts(has_cicd, 50) + pts(has_tests, 30)
        + pts(has_dependabot || has_renovate, 10) + pts(has_lockfile, 10);
    let documentation = pts(has_readme, 30)
        + pts(readme_size >= 500, 10)  // bonus for non-trivial README
        + pts(has_docs_dir, 25)
        + pts(has_changelog, 15)
        + pts(has_contributing, 10) + pts(has_security, 10);
    let supply_chain = pts(has_license, 30) + pts(has_dependabot || has_renovate, 30)
        + pts(has_codeowners, 20) + pts(has_security, 10) + pts(has_lockfile, 10);
    let modernity = pts(has_framework, 30) + pts(has_db, 20)
        + pts(has_any_cloud, 30)
        + pts(claude_md || agents_md || cursor_dir || copilot_instr || claude_dir || aider_conf, 20);
    let testing_culture = pts(has_tests, 60) + pts(has_cicd, 40);

    fn grade(score: u32) -> &'static str {
        if score >= 90 { "A" } else if score >= 75 { "B" }
        else if score >= 60 { "C" } else if score >= 40 { "D" } else { "F" }
    }
    let categories = [
        ("engineering", engineering),
        ("documentation", documentation),
        ("supply_chain", supply_chain),
        ("modernity", modernity),
        ("testing_culture", testing_culture),
    ];
    let overall: u32 = categories.iter().map(|(_, s)| *s).sum::<u32>() / categories.len() as u32;

    let report = json!({
        "overall_score": overall,
        "overall_grade": grade(overall),
        "categories": {
            "engineering":     {"score": engineering,      "grade": grade(engineering)},
            "documentation":   {"score": documentation,    "grade": grade(documentation)},
            "supply_chain":    {"score": supply_chain,     "grade": grade(supply_chain)},
            "modernity":       {"score": modernity,        "grade": grade(modernity)},
            "testing_culture": {"score": testing_culture,  "grade": grade(testing_culture)},
        },
        "signals": {
            "has_cicd": has_cicd, "has_tests": has_tests, "has_framework": has_framework,
            "has_db": has_db, "has_any_cloud": has_any_cloud,
            "has_readme": has_readme, "readme_size": readme_size,
            "has_changelog": has_changelog, "has_contributing": has_contributing,
            "has_security": has_security, "has_license": has_license,
            "has_docs_dir": has_docs_dir,
            "has_dependabot": has_dependabot, "has_renovate": has_renovate,
            "has_codeowners": has_codeowners, "has_lockfile": has_lockfile,
            "ai_tooling": {
                "claude_md": claude_md, "agents_md": agents_md,
                "cursor": cursor_dir, "copilot_instructions": copilot_instr,
                "claude_dir": claude_dir, "aider_conf": aider_conf,
            },
        },
    });

    println!("{}", serde_json::to_string(&report)?);
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

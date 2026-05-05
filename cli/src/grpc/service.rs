use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;

use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};

use super::proto::repo_analyze_service_server::RepoAnalyzeService;
use super::proto::*;
use super::section_cache::SectionCacheManager;

pub struct RepoAnalyzeServiceImpl {
    pub cache_manager: Arc<SectionCacheManager>,
}

type ProgressStream =
    Pin<Box<dyn tokio_stream::Stream<Item = Result<ScanProgress, Status>> + Send>>;

#[tonic::async_trait]
impl RepoAnalyzeService for RepoAnalyzeServiceImpl {
    type ScanStream = ProgressStream;

    async fn scan(
        &self,
        request: Request<ScanRequest>,
    ) -> Result<Response<Self::ScanStream>, Status> {
        let req = request.into_inner();

        let repo_path = PathBuf::from(&req.repo_path);
        let out_path = PathBuf::from(&req.out_path);

        if !repo_path.exists() {
            return Err(Status::not_found(format!(
                "repo not found: {}",
                req.repo_path
            )));
        }

        let (tx, rx) = mpsc::channel(32);

        // Build ScanArgs from the request
        let merge_policy = match req.merge_policy.as_str() {
            "all-parents" => crate::cli::MergePolicy::AllParents,
            _ => crate::cli::MergePolicy::FirstParent,
        };

        let args = crate::cli::ScanArgs {
            repo: repo_path,
            out: out_path,
            threads: req.threads.map(|t| t as usize),
            merge_policy,
            renames: if req.renames {
                crate::cli::OnOff::On
            } else {
                crate::cli::OnOff::Off
            },
            copies: if req.copies {
                crate::cli::OnOff::On
            } else {
                crate::cli::OnOff::Off
            },
            rename_threshold: req.rename_threshold.min(100) as u8,
            include_remotes: if req.include_remotes {
                crate::cli::OnOff::On
            } else {
                crate::cli::OnOff::Off
            },
            max_top: if req.max_top > 0 {
                req.max_top as usize
            } else {
                50
            },
            format: crate::cli::OutputFormat::Raw,
            report: if req.report {
                crate::cli::OnOff::On
            } else {
                crate::cli::OnOff::Off
            },
            telemetry: crate::cli::OnOff::On,
            since: None,
            until: None,
            max_diff_files: if req.max_diff_files > 0 {
                req.max_diff_files as usize
            } else {
                1000
            },
            merge_diff_limit: if req.merge_diff_limit > 0 {
                req.merge_diff_limit as usize
            } else {
                100
            },
            worker_cache_mb: if req.worker_cache_mb > 0 {
                req.worker_cache_mb as usize
            } else {
                128
            },
            sizer_cache_mb: 64,
            sizer_chunk_size: 10_000,
            channel_capacity: 256,
            max_commits: 0,
        };

        // Run pipeline in a blocking task, sending progress via channel
        let progress_tx = tx.clone();
        tokio::task::spawn_blocking(move || {
            let start = std::time::Instant::now();

            let _ = progress_tx.blocking_send(Ok(ScanProgress {
                phase: "start".into(),
                message: "Starting scan...".into(),
                commits_processed: 0,
                file_changes_processed: 0,
                elapsed_seconds: 0.0,
                done: false,
                error: String::new(),
            }));

            match crate::pipeline::run_pipeline(&args) {
                Ok(()) => {
                    let _ = progress_tx.blocking_send(Ok(ScanProgress {
                        phase: "done".into(),
                        message: "Scan complete".into(),
                        commits_processed: 0,
                        file_changes_processed: 0,
                        elapsed_seconds: start.elapsed().as_secs_f64(),
                        done: true,
                        error: String::new(),
                    }));
                }
                Err(e) => {
                    let _ = progress_tx.blocking_send(Ok(ScanProgress {
                        phase: "error".into(),
                        message: String::new(),
                        commits_processed: 0,
                        file_changes_processed: 0,
                        elapsed_seconds: start.elapsed().as_secs_f64(),
                        done: true,
                        error: e.to_string(),
                    }));
                }
            }
        });

        let stream = ReceiverStream::new(rx);
        Ok(Response::new(Box::pin(stream) as Self::ScanStream))
    }

    async fn detect_tech(
        &self,
        request: Request<DetectTechRequest>,
    ) -> Result<Response<DetectTechResponse>, Status> {
        let req = request.into_inner();
        let repo_path = PathBuf::from(&req.repo_path);

        if !repo_path.exists() {
            return Err(Status::not_found(format!(
                "repo not found: {}",
                req.repo_path
            )));
        }

        let result =
            tokio::task::spawn_blocking(move || crate::techdetect::run_detect_tech(&repo_path))
                .await
                .map_err(|e| Status::internal(format!("task failed: {e}")))?
                .map_err(|e| Status::internal(format!("detect-tech failed: {e}")))?;

        let json = serde_json::to_string_pretty(&result)
            .map_err(|e| Status::internal(format!("json serialization failed: {e}")))?;

        Ok(Response::new(DetectTechResponse { json }))
    }

    async fn get_report(
        &self,
        request: Request<GetReportRequest>,
    ) -> Result<Response<GetReportResponse>, Status> {
        let req = request.into_inner();
        let out_path = PathBuf::from(&req.out_path);

        let read_file = |name: &str| -> Result<String, Status> {
            let path = out_path.join(name);
            std::fs::read_to_string(&path).map_err(|e| Status::not_found(format!("{name}: {e}")))
        };

        Ok(Response::new(GetReportResponse {
            metrics_json: read_file("metrics.json")?,
            timelines_json: read_file("data/timelines.json").unwrap_or_default(),
            authors_json: read_file("data/authors.json").unwrap_or_default(),
            hotspots_json: read_file("data/hotspots.json").unwrap_or_default(),
        }))
    }

    async fn list_sections(
        &self,
        _request: Request<ListSectionsRequest>,
    ) -> Result<Response<ListSectionsResponse>, Status> {
        let sections = super::sections::SECTIONS
            .iter()
            .map(|s| SectionInfo {
                name: s.name.to_string(),
                description: s.description.to_string(),
                data_keys: s.data_keys.iter().map(|k| k.to_string()).collect(),
                tables_needed: s.tables_needed.iter().map(|t| t.to_string()).collect(),
            })
            .collect();
        Ok(Response::new(ListSectionsResponse { sections }))
    }

    async fn get_section(
        &self,
        request: Request<GetSectionRequest>,
    ) -> Result<Response<GetSectionResponse>, Status> {
        let req = request.into_inner();
        let cache_manager = Arc::clone(&self.cache_manager);
        let section = req.section.clone();
        let out_path = req.out_path.clone();
        let repo_path = req.repo_path.clone();

        let data_json = tokio::task::spawn_blocking(move || {
            let cache = cache_manager
                .get_or_load(&out_path)
                .map_err(|e| Status::internal(e.to_string()))?;
            let rp = repo_path.as_deref().map(std::path::Path::new);
            let value = super::sections::compute_section(&section, &cache, rp)?;
            serde_json::to_string(&value)
                .map_err(|e| Status::internal(format!("json serialization failed: {e}")))
        })
        .await
        .map_err(|e| Status::internal(format!("task failed: {e}")))??;

        Ok(Response::new(GetSectionResponse {
            section: req.section,
            data_json,
        }))
    }

    async fn describe_scan(
        &self,
        request: Request<DescribeScanRequest>,
    ) -> Result<Response<DescribeScanResponse>, Status> {
        let req = request.into_inner();
        let out_path = PathBuf::from(&req.out_path);

        let has_metrics = out_path.join("metrics.json").exists();
        let has_commit_stats = out_path.join("tables/commit_stats.bin").exists();
        let has_file_stats = out_path.join("tables/file_stats.bin").exists();
        let has_messages = out_path.join("tables/messages.txt").exists();

        // Load metrics for summary stats if available
        let (total_commits, total_files_changed, total_authors) = if has_metrics {
            match crate::model::loader::load_metrics(&out_path) {
                Ok(m) => (m.total_commits, m.total_files_changed, m.total_authors),
                Err(_) => (0, 0, 0),
            }
        } else {
            (0, 0, 0)
        };

        // Determine which sections can be computed based on available data
        let available_sections: Vec<String> = super::sections::SECTIONS
            .iter()
            .filter(|s| {
                s.tables_needed.iter().all(|table| match *table {
                    "commit_stats" => has_commit_stats,
                    "file_stats" => has_file_stats,
                    "messages" => true, // messages are optional for all sections
                    _ => true,
                }) && has_metrics // all sections need metrics
            })
            .map(|s| s.name.to_string())
            .collect();

        Ok(Response::new(DescribeScanResponse {
            has_metrics,
            has_commit_stats,
            has_file_stats,
            has_messages,
            total_commits,
            total_files_changed,
            total_authors,
            available_sections,
        }))
    }

    async fn health(
        &self,
        _request: Request<HealthRequest>,
    ) -> Result<Response<HealthResponse>, Status> {
        Ok(Response::new(HealthResponse {
            status: "serving".into(),
            version: env!("CARGO_PKG_VERSION").into(),
        }))
    }

    // ── Stubs for proto methods not yet wired up ───────────────────
    // The .proto file declares these RPCs but the corresponding impls
    // haven't landed yet. Stubbing with Unimplemented keeps the lib
    // compiling so the CLI binary can build; the desktop app already
    // composes these features client-side.

    async fn score_report_card(
        &self,
        _request: Request<ScoreRequest>,
    ) -> Result<Response<ScoreResponse>, Status> {
        Err(Status::unimplemented(
            "score_report_card not yet implemented",
        ))
    }

    async fn evaluate_policy(
        &self,
        _request: Request<PolicyRequest>,
    ) -> Result<Response<PolicyResponse>, Status> {
        Err(Status::unimplemented("evaluate_policy not yet implemented"))
    }

    async fn generate_sbom(
        &self,
        _request: Request<SbomRequest>,
    ) -> Result<Response<SbomResponse>, Status> {
        Err(Status::unimplemented("generate_sbom not yet implemented"))
    }

    async fn export_report(
        &self,
        _request: Request<ExportRequest>,
    ) -> Result<Response<ExportResponse>, Status> {
        Err(Status::unimplemented("export_report not yet implemented"))
    }

    type ScanOrgStream =
        Pin<Box<dyn tokio_stream::Stream<Item = Result<OrgScanProgress, Status>> + Send>>;

    async fn scan_org(
        &self,
        _request: Request<OrgScanRequest>,
    ) -> Result<Response<Self::ScanOrgStream>, Status> {
        Err(Status::unimplemented("scan_org not yet implemented"))
    }

    async fn compare_repos(
        &self,
        _request: Request<CompareRequest>,
    ) -> Result<Response<CompareResponse>, Status> {
        Err(Status::unimplemented("compare_repos not yet implemented"))
    }
}

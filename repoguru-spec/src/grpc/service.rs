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

type ProgressStream = Pin<Box<dyn tokio_stream::Stream<Item = Result<ScanProgress, Status>> + Send>>;

#[tonic::async_trait]
impl RepoAnalyzeService for RepoAnalyzeServiceImpl {
    type ScanStream = ProgressStream;

    async fn scan(&self, request: Request<ScanRequest>) -> Result<Response<Self::ScanStream>, Status> {
        let req = request.into_inner();

        let repo_path = PathBuf::from(&req.repo_path);
        let out_path = PathBuf::from(&req.out_path);

        if !repo_path.exists() {
            return Err(Status::not_found(format!("repo not found: {}", req.repo_path)));
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
            renames: if req.renames { crate::cli::OnOff::On } else { crate::cli::OnOff::Off },
            copies: if req.copies { crate::cli::OnOff::On } else { crate::cli::OnOff::Off },
            rename_threshold: req.rename_threshold.min(100) as u8,
            include_remotes: if req.include_remotes { crate::cli::OnOff::On } else { crate::cli::OnOff::Off },
            max_top: if req.max_top > 0 { req.max_top as usize } else { 50 },
            format: crate::cli::OutputFormat::Raw,
            report: if req.report { crate::cli::OnOff::On } else { crate::cli::OnOff::Off },
            telemetry: crate::cli::OnOff::On,
            since: None,
            until: None,
            max_diff_files: if req.max_diff_files > 0 { req.max_diff_files as usize } else { 1000 },
            merge_diff_limit: if req.merge_diff_limit > 0 { req.merge_diff_limit as usize } else { 100 },
            worker_cache_mb: if req.worker_cache_mb > 0 { req.worker_cache_mb as usize } else { 128 },
            sizer_cache_mb: 64,
            sizer_chunk_size: 10_000,
            channel_capacity: 256,
            verbose: false,
            github: crate::cli::GitHubMode::Auto,
            github_token: None,
            github_api_url: "https://api.github.com".to_string(),
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
            return Err(Status::not_found(format!("repo not found: {}", req.repo_path)));
        }

        let result = tokio::task::spawn_blocking(move || {
            crate::techdetect::run_detect_tech(&repo_path)
        })
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
            std::fs::read_to_string(&path)
                .map_err(|e| Status::not_found(format!("{name}: {e}")))
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
        .map_err(|e| Status::internal(format!("task failed: {e}")))?
        ?;

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

    async fn score_report_card(
        &self,
        request: Request<ScoreRequest>,
    ) -> Result<Response<ScoreResponse>, Status> {
        let req = request.into_inner();
        let repo_path = PathBuf::from(&req.repo_path);
        let out_path = req.out_path.map(|p| PathBuf::from(p));

        if !repo_path.exists() {
            return Err(Status::not_found(format!("repo not found: {}", req.repo_path)));
        }

        let result = tokio::task::spawn_blocking(move || {
            crate::scoring::score_repo(&repo_path, out_path.as_deref())
        })
        .await
        .map_err(|e| Status::internal(format!("task failed: {e}")))?
        .map_err(|e| Status::internal(format!("scoring failed: {e}")))?;

        Ok(Response::new(ScoreResponse {
            overall_score: result.overall_score,
            grade: result.grade,
            categories: result
                .categories
                .into_iter()
                .map(|c| CategoryScore {
                    key: c.key,
                    label: c.label,
                    score: c.score,
                    grade: c.grade,
                    weight: c.weight,
                    signals: c
                        .signals
                        .into_iter()
                        .map(|s| Signal {
                            name: s.name,
                            found: s.found,
                            details: s.details,
                            points: s.points,
                        })
                        .collect(),
                })
                .collect(),
            strengths: result.strengths,
            risks: result.risks,
            next_steps: result.next_steps,
            scored_at: result.scored_at,
        }))
    }

    async fn evaluate_policy(
        &self,
        request: Request<PolicyRequest>,
    ) -> Result<Response<PolicyResponse>, Status> {
        let req = request.into_inner();

        // Reconstruct the ScoreResult from the proto ScoreResponse
        let report_card = req.report_card
            .ok_or_else(|| Status::invalid_argument("report_card is required"))?;

        let score_result = proto_score_to_domain(&report_card);

        let evaluation = if !req.preset.is_empty() {
            crate::policy::evaluate_preset(&req.preset, &score_result)
                .map_err(|e| Status::invalid_argument(e))?
        } else {
            let custom = req.custom_policy
                .ok_or_else(|| Status::invalid_argument("either preset or custom_policy required"))?;
            let policy = proto_policy_to_domain(&custom);
            crate::policy::evaluate(&policy, &score_result)
        };

        Ok(Response::new(PolicyResponse {
            passed: evaluation.passed,
            pass_count: evaluation.pass_count,
            fail_count: evaluation.fail_count,
            results: evaluation.results.into_iter().map(|r| PolicyRuleResult {
                rule: Some(PolicyRule {
                    id: r.rule.id,
                    name: r.rule.name,
                    description: r.rule.description,
                    r#type: r.rule.rule_type,
                    operator: r.rule.operator,
                    value: r.rule.value,
                    category: r.rule.category,
                    signal: r.rule.signal,
                    severity: r.rule.severity,
                }),
                passed: r.passed,
                actual: r.actual,
                expected: r.expected,
            }).collect(),
            evaluated_at: evaluation.evaluated_at,
        }))
    }

    async fn generate_sbom(
        &self,
        request: Request<SbomRequest>,
    ) -> Result<Response<SbomResponse>, Status> {
        let req = request.into_inner();
        let repo_path = PathBuf::from(&req.repo_path);

        if !repo_path.exists() {
            return Err(Status::not_found(format!("repo not found: {}", req.repo_path)));
        }

        let result = tokio::task::spawn_blocking(move || {
            crate::sbom::generate_sbom(&repo_path)
        })
        .await
        .map_err(|e| Status::internal(format!("task failed: {e}")))?
        .map_err(|e| Status::internal(format!("SBOM generation failed: {e}")))?;

        Ok(Response::new(SbomResponse {
            format: result.format,
            content: result.content,
            component_count: result.component_count,
        }))
    }

    async fn export_report(
        &self,
        request: Request<ExportRequest>,
    ) -> Result<Response<ExportResponse>, Status> {
        let req = request.into_inner();
        let report_card = req.report_card
            .ok_or_else(|| Status::invalid_argument("report_card is required"))?;

        let score = proto_score_to_domain(&report_card);
        let result = crate::export::export(
            &req.format,
            &score,
            &req.repo_name,
            &req.badge_style,
            &req.badge_label,
        ).map_err(|e| Status::invalid_argument(e))?;

        Ok(Response::new(ExportResponse {
            format: result.format,
            content: result.content,
            content_type: result.content_type,
        }))
    }

    type ScanOrgStream = Pin<Box<dyn tokio_stream::Stream<Item = Result<OrgScanProgress, Status>> + Send>>;

    async fn scan_org(
        &self,
        request: Request<OrgScanRequest>,
    ) -> Result<Response<Self::ScanOrgStream>, Status> {
        let req = request.into_inner();

        if req.org_or_user.is_empty() {
            return Err(Status::invalid_argument("org_or_user is required"));
        }
        if req.github_token.is_empty() {
            return Err(Status::invalid_argument("github_token is required"));
        }

        let clone_base = if req.clone_base_dir.is_empty() {
            std::env::temp_dir()
                .join("repoanalyze-orgscan")
                .to_string_lossy()
                .to_string()
        } else {
            req.clone_base_dir.clone()
        };

        let domain_req = crate::orgscan::OrgScanRequest {
            org_or_user: req.org_or_user,
            is_user: req.is_user,
            github_token: req.github_token,
            clone_base_dir: clone_base,
            max_repos: req.max_repos,
            skip_forks: req.skip_forks,
            skip_archived: req.skip_archived,
        };

        let (tx, rx) = mpsc::channel(32);

        tokio::task::spawn_blocking(move || {
            let progress_tx = tx;
            let send_result = crate::orgscan::run_org_scan(&domain_req, |update| {
                let proto_scores: Vec<super::proto::RepoScore> = update
                    .repo_scores
                    .iter()
                    .map(|rs| super::proto::RepoScore {
                        repo_name: rs.repo_name.clone(),
                        overall_score: rs.overall_score,
                        grade: rs.grade.clone(),
                        categories: rs
                            .categories
                            .iter()
                            .map(|c| CategoryScore {
                                key: c.key.clone(),
                                label: c.label.clone(),
                                score: c.score,
                                grade: c.grade.clone(),
                                weight: c.weight,
                                signals: c
                                    .signals
                                    .iter()
                                    .map(|s| Signal {
                                        name: s.name.clone(),
                                        found: s.found,
                                        details: s.details.clone(),
                                        points: s.points,
                                    })
                                    .collect(),
                            })
                            .collect(),
                    })
                    .collect();

                let _ = progress_tx.blocking_send(Ok(OrgScanProgress {
                    phase: update.phase,
                    repo_name: update.repo_name,
                    repos_total: update.repos_total,
                    repos_completed: update.repos_completed,
                    repo_scores: proto_scores,
                    average_score: update.average_score,
                    average_grade: update.average_grade,
                    error: update.error,
                }));
            });

            if let Err(e) = send_result {
                let _ = progress_tx.blocking_send(Ok(OrgScanProgress {
                    phase: "error".into(),
                    repo_name: String::new(),
                    repos_total: 0,
                    repos_completed: 0,
                    repo_scores: Vec::new(),
                    average_score: 0.0,
                    average_grade: String::new(),
                    error: e.to_string(),
                }));
            }
        });

        let stream = ReceiverStream::new(rx);
        Ok(Response::new(Box::pin(stream) as Self::ScanOrgStream))
    }

    async fn compare_repos(
        &self,
        request: Request<CompareRequest>,
    ) -> Result<Response<CompareResponse>, Status> {
        let req = request.into_inner();
        let repo_a = PathBuf::from(&req.repo_path_a);
        let repo_b = PathBuf::from(&req.repo_path_b);
        let out_a = req.out_path_a.map(PathBuf::from);
        let out_b = req.out_path_b.map(PathBuf::from);

        if !repo_a.exists() {
            return Err(Status::not_found(format!("repo A not found: {}", req.repo_path_a)));
        }
        if !repo_b.exists() {
            return Err(Status::not_found(format!("repo B not found: {}", req.repo_path_b)));
        }

        let result = tokio::task::spawn_blocking(move || {
            crate::compare::compare(&repo_a, &repo_b, out_a.as_deref(), out_b.as_deref())
        })
        .await
        .map_err(|e| Status::internal(format!("task failed: {e}")))?
        .map_err(|e| Status::internal(format!("compare failed: {e}")))?;

        Ok(Response::new(CompareResponse {
            report_card_a: Some(domain_score_to_proto(&result.report_card_a)),
            report_card_b: Some(domain_score_to_proto(&result.report_card_b)),
            deltas: result
                .deltas
                .into_iter()
                .map(|d| super::proto::ComparisonDelta {
                    category: d.category,
                    score_a: d.score_a,
                    score_b: d.score_b,
                    delta: d.delta,
                    winner: d.winner,
                })
                .collect(),
            winner: result.winner,
            score_delta: result.score_delta,
        }))
    }
}

/// Convert a proto ScoreResponse to domain ScoreResult.
fn proto_score_to_domain(proto: &ScoreResponse) -> crate::scoring::ScoreResult {
    crate::scoring::ScoreResult {
        overall_score: proto.overall_score,
        grade: proto.grade.clone(),
        categories: proto.categories.iter().map(|c| crate::scoring::CategoryScore {
            key: c.key.clone(),
            label: c.label.clone(),
            score: c.score,
            grade: c.grade.clone(),
            weight: c.weight,
            signals: c.signals.iter().map(|s| crate::scoring::Signal {
                name: s.name.clone(),
                found: s.found,
                details: s.details.clone(),
                points: s.points,
            }).collect(),
        }).collect(),
        strengths: proto.strengths.clone(),
        risks: proto.risks.clone(),
        next_steps: proto.next_steps.clone(),
        scored_at: proto.scored_at.clone(),
    }
}

/// Convert a domain ScoreResult to proto ScoreResponse.
fn domain_score_to_proto(score: &crate::scoring::ScoreResult) -> ScoreResponse {
    ScoreResponse {
        overall_score: score.overall_score,
        grade: score.grade.clone(),
        categories: score.categories.iter().map(|c| CategoryScore {
            key: c.key.clone(),
            label: c.label.clone(),
            score: c.score,
            grade: c.grade.clone(),
            weight: c.weight,
            signals: c.signals.iter().map(|s| Signal {
                name: s.name.clone(),
                found: s.found,
                details: s.details.clone(),
                points: s.points,
            }).collect(),
        }).collect(),
        strengths: score.strengths.clone(),
        risks: score.risks.clone(),
        next_steps: score.next_steps.clone(),
        scored_at: score.scored_at.clone(),
    }
}

/// Convert a proto PolicySet to domain PolicySet.
fn proto_policy_to_domain(proto: &super::proto::PolicySet) -> crate::policy::PolicySet {
    crate::policy::PolicySet {
        id: proto.id.clone(),
        name: proto.name.clone(),
        description: proto.description.clone(),
        rules: proto.rules.iter().map(|r| crate::policy::PolicyRule {
            id: r.id.clone(),
            name: r.name.clone(),
            description: r.description.clone(),
            rule_type: r.r#type.clone(),
            operator: r.operator.clone(),
            value: r.value,
            category: r.category.clone(),
            signal: r.signal.clone(),
            severity: r.severity.clone(),
        }).collect(),
    }
}

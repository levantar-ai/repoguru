use std::sync::Arc;

use tonic::transport::Server;

use super::proto::repo_analyze_service_server::RepoAnalyzeServiceServer;
use super::section_cache::SectionCacheManager;
use super::service::RepoAnalyzeServiceImpl;

/// Start the gRPC server on the given address.
pub async fn run_server(addr: &str) -> Result<(), Box<dyn std::error::Error>> {
    let addr = addr.parse()?;
    let service = RepoAnalyzeServiceImpl {
        cache_manager: Arc::new(SectionCacheManager::new()),
    };

    eprintln!("RepoAnalyze gRPC server listening on {addr}");

    Server::builder()
        .add_service(RepoAnalyzeServiceServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}

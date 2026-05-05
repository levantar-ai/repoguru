pub mod section_cache;
pub mod sections;
pub mod server;
pub mod service;

pub mod proto {
    tonic::include_proto!("repoanalyze.v1");
}

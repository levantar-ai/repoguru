use std::collections::BTreeMap;

use serde::Serialize;

/// A detected cloud service (AWS, Azure, GCP).
#[derive(Debug, Clone, Serialize)]
pub struct DetectedCloudService {
    pub service: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_package: Option<String>,
    pub source: String,
    pub via: String,
}

/// A detected package/dependency.
#[derive(Debug, Clone, Serialize)]
pub struct DetectedPackage {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub source: String,
}

/// A detected framework.
#[derive(Debug, Clone, Serialize)]
pub struct DetectedFramework {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub source: String,
    pub via: String,
}

/// A detected database technology.
#[derive(Debug, Clone, Serialize)]
pub struct DetectedDatabase {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub source: String,
    pub via: String,
}

/// A detected CI/CD tool.
#[derive(Debug, Clone, Serialize)]
pub struct DetectedCicdTool {
    pub name: String,
    pub source: String,
    pub category: String,
}

/// A detected testing/quality tool.
#[derive(Debug, Clone, Serialize)]
pub struct DetectedTestingTool {
    pub name: String,
    pub source: String,
    pub via: String,
    pub category: String,
}

/// Complete tech detection result.
#[derive(Debug, Clone, Serialize)]
pub struct TechDetectResult {
    pub aws: Vec<DetectedCloudService>,
    pub azure: Vec<DetectedCloudService>,
    pub gcp: Vec<DetectedCloudService>,
    pub python: Vec<DetectedPackage>,
    pub node: Vec<DetectedPackage>,
    pub go: Vec<DetectedPackage>,
    pub java: Vec<DetectedPackage>,
    pub php: Vec<DetectedPackage>,
    pub rust: Vec<DetectedPackage>,
    pub ruby: Vec<DetectedPackage>,
    pub frameworks: Vec<DetectedFramework>,
    pub databases: Vec<DetectedDatabase>,
    pub cicd: Vec<DetectedCicdTool>,
    pub testing: Vec<DetectedTestingTool>,
    pub languages: BTreeMap<String, u64>,
    pub manifest_files: Vec<String>,
    pub total_files: u64,
}

/// A file read from the git tree for analysis.
#[derive(Debug, Clone)]
pub struct FileInput {
    pub path: String,
    pub content: String,
}

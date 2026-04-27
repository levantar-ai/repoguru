//! SBOM generation — CycloneDX 1.5 JSON from detected dependencies.

pub mod cyclonedx;

use std::path::Path;

use crate::error::ScanError;
use crate::techdetect;
use cyclonedx::CycloneDxBom;

/// Generate a CycloneDX 1.5 SBOM from a repository.
pub fn generate_sbom(repo_path: &Path) -> Result<SbomResult, ScanError> {
    let tech = techdetect::run_detect_tech(repo_path)?;
    let bom = CycloneDxBom::from_tech_detect(&tech, repo_path);
    let content = serde_json::to_string_pretty(&bom)
        .map_err(|e| ScanError::ScanFailed(format!("SBOM serialization failed: {e}")))?;
    let component_count = bom.components.as_ref().map(|c| c.len() as u32).unwrap_or(0);

    Ok(SbomResult {
        format: "cyclonedx-json".to_string(),
        content,
        component_count,
    })
}

/// Result of SBOM generation.
#[derive(Debug, Clone)]
pub struct SbomResult {
    pub format: String,
    pub content: String,
    pub component_count: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_sbom_for_self() {
        let repo_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let result = generate_sbom(&repo_path).expect("SBOM generation should succeed");
        assert_eq!(result.format, "cyclonedx-json");
        assert!(result.component_count > 0, "should detect at least some components");

        // Parse the JSON to verify it's valid CycloneDX
        let bom: serde_json::Value = serde_json::from_str(&result.content)
            .expect("SBOM should be valid JSON");
        assert_eq!(bom["bomFormat"], "CycloneDX");
        assert_eq!(bom["specVersion"], "1.5");
        assert!(bom["components"].is_array());
    }
}

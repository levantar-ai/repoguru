//! CycloneDX 1.5 JSON SBOM serialization.

use std::collections::BTreeMap;
use std::path::Path;

use serde::Serialize;

use crate::techdetect::types::TechDetectResult;

/// CycloneDX 1.5 BOM document.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CycloneDxBom {
    pub bom_format: String,
    pub spec_version: String,
    pub serial_number: String,
    pub version: u32,
    pub metadata: BomMetadata,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub components: Option<Vec<Component>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BomMetadata {
    pub timestamp: String,
    pub tools: Vec<ToolInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub component: Option<Component>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolInfo {
    pub vendor: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Component {
    #[serde(rename = "type")]
    pub component_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub purl: Option<String>,
    #[serde(rename = "bom-ref")]
    pub bom_ref: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl CycloneDxBom {
    /// Build a CycloneDX BOM from tech detection results.
    pub fn from_tech_detect(tech: &TechDetectResult, repo_path: &Path) -> Self {
        let mut components = Vec::new();
        let mut seen = BTreeMap::new();

        // Add language-based components (languages is BTreeMap<String, u64>)
        let total_files: u64 = tech.languages.values().sum();
        for (name, &file_count) in &tech.languages {
            let key = format!("lang:{name}");
            if seen.contains_key(&key) {
                continue;
            }
            seen.insert(key.clone(), true);
            let pct = if total_files > 0 {
                (file_count as f64 / total_files as f64) * 100.0
            } else {
                0.0
            };
            components.push(Component {
                component_type: "framework".to_string(),
                group: None,
                name: name.clone(),
                version: None,
                purl: None,
                bom_ref: key,
                description: Some(format!(
                    "Language: {name} ({file_count} files, {pct:.1}%)"
                )),
            });
        }

        // Add detected packages from each ecosystem
        add_packages(&mut components, &mut seen, &tech.node, "npm");
        add_packages(&mut components, &mut seen, &tech.python, "pypi");
        add_packages(&mut components, &mut seen, &tech.go, "golang");
        add_packages(&mut components, &mut seen, &tech.java, "maven");
        add_packages(&mut components, &mut seen, &tech.php, "composer");
        add_packages(&mut components, &mut seen, &tech.rust, "cargo");
        add_packages(&mut components, &mut seen, &tech.ruby, "gem");

        // Add frameworks
        for fw in &tech.frameworks {
            let key = format!("framework:{}", fw.name);
            if seen.contains_key(&key) {
                continue;
            }
            seen.insert(key.clone(), true);
            components.push(Component {
                component_type: "framework".to_string(),
                group: None,
                name: fw.name.clone(),
                version: fw.version.clone(),
                purl: None,
                bom_ref: key,
                description: Some(fw.source.clone()),
            });
        }

        // Add cloud services (via field indicates provider: "aws-sdk", "terraform", etc.)
        for svc in tech.aws.iter().chain(&tech.azure).chain(&tech.gcp) {
            let key = format!("service:{}", svc.service);
            if seen.contains_key(&key) {
                continue;
            }
            seen.insert(key.clone(), true);
            components.push(Component {
                component_type: "external-service".to_string(),
                group: Some(svc.via.clone()),
                name: svc.service.clone(),
                version: None,
                purl: None,
                bom_ref: key,
                description: Some(svc.source.clone()),
            });
        }

        // Add databases
        for db in &tech.databases {
            let key = format!("database:{}", db.name);
            if seen.contains_key(&key) {
                continue;
            }
            seen.insert(key.clone(), true);
            components.push(Component {
                component_type: "library".to_string(),
                group: None,
                name: db.name.clone(),
                version: db.version.clone(),
                purl: None,
                bom_ref: key,
                description: Some(db.source.clone()),
            });
        }

        // Add CI/CD tools
        for ci in &tech.cicd {
            let key = format!("cicd:{}", ci.name);
            if seen.contains_key(&key) {
                continue;
            }
            seen.insert(key.clone(), true);
            components.push(Component {
                component_type: "platform".to_string(),
                group: None,
                name: ci.name.clone(),
                version: None,
                purl: None,
                bom_ref: key,
                description: Some(ci.source.clone()),
            });
        }

        // Repo name as the main component
        let repo_name = repo_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        CycloneDxBom {
            bom_format: "CycloneDX".to_string(),
            spec_version: "1.5".to_string(),
            serial_number: generate_urn(),
            version: 1,
            metadata: BomMetadata {
                timestamp: crate::scoring::chrono_now_iso8601(),
                tools: vec![ToolInfo {
                    vendor: "RepoGuru".to_string(),
                    name: "repoanalyze".to_string(),
                    version: env!("CARGO_PKG_VERSION").to_string(),
                }],
                component: Some(Component {
                    component_type: "application".to_string(),
                    group: None,
                    name: repo_name,
                    version: None,
                    purl: None,
                    bom_ref: "root".to_string(),
                    description: None,
                }),
            },
            components: if components.is_empty() {
                None
            } else {
                Some(components)
            },
        }
    }
}

fn add_packages(
    components: &mut Vec<Component>,
    seen: &mut BTreeMap<String, bool>,
    packages: &[crate::techdetect::types::DetectedPackage],
    ecosystem: &str,
) {
    for pkg in packages {
        let key = format!("pkg:{ecosystem}/{}", pkg.name);
        if seen.contains_key(&key) {
            continue;
        }
        seen.insert(key.clone(), true);

        let purl = Some(format!(
            "pkg:{ecosystem}/{}{}",
            pkg.name,
            pkg.version
                .as_deref()
                .map(|v| format!("@{v}"))
                .unwrap_or_default()
        ));

        components.push(Component {
            component_type: "library".to_string(),
            group: None,
            name: pkg.name.clone(),
            version: pkg.version.clone(),
            purl,
            bom_ref: key,
            description: None,
        });
    }
}

/// Generate a URN UUID v4-style identifier (without pulling in the uuid crate).
fn generate_urn() -> String {
    use std::time::SystemTime;
    let seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!(
        "urn:uuid:{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (seed & 0xFFFF_FFFF) as u32,
        ((seed >> 32) & 0xFFFF) as u16,
        ((seed >> 48) & 0x0FFF) as u16,
        (0x8000 | ((seed >> 60) & 0x3FFF)) as u16,
        (seed >> 64) as u64 & 0xFFFF_FFFF_FFFF,
    )
}

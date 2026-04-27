//! Detection functions for all technology categories.
//! Each function takes a slice of FileInput and returns detected items.

use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::sync::LazyLock;

use regex::Regex;

use super::rules;
use super::types::*;

// ── Helpers ──

fn title_case(s: &str) -> String {
    s.split(['-', '_'])
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => {
                    let mut s = c.to_uppercase().to_string();
                    s.extend(chars);
                    s
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn basename(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn is_python_manifest(path: &str) -> bool {
    let b = basename(path);
    matches!(
        b,
        "requirements.txt" | "pyproject.toml" | "Pipfile" | "setup.py" | "setup.cfg"
    ) || path.contains("requirements/") && path.ends_with(".txt")
}

/// Parse a package.json, returning combined dependencies + devDependencies.
fn parse_package_json_deps(content: &str) -> BTreeMap<String, String> {
    let mut result = BTreeMap::new();
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
        for section in &["dependencies", "devDependencies"] {
            if let Some(deps) = val.get(section).and_then(|d| d.as_object()) {
                for (k, v) in deps {
                    result.insert(k.clone(), v.as_str().unwrap_or("").to_string());
                }
            }
        }
    }
    result
}

/// Parse a composer.json, returning combined require + require-dev.
fn parse_composer_json_deps(content: &str) -> BTreeMap<String, String> {
    let mut result = BTreeMap::new();
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(content) {
        for section in &["require", "require-dev"] {
            if let Some(deps) = val.get(section).and_then(|d| d.as_object()) {
                for (k, v) in deps {
                    result.insert(k.clone(), v.as_str().unwrap_or("").to_string());
                }
            }
        }
    }
    result
}

fn dedup_cloud(mut services: Vec<DetectedCloudService>) -> Vec<DetectedCloudService> {
    let mut seen = BTreeSet::new();
    services.retain(|s| {
        let key = format!("{}|{}|{}", s.service, s.via, s.source);
        seen.insert(key)
    });
    services.sort_by(|a, b| a.service.cmp(&b.service));
    services
}

fn dedup_packages(mut packages: Vec<DetectedPackage>) -> Vec<DetectedPackage> {
    let mut seen = BTreeSet::new();
    packages.retain(|p| {
        let key = format!("{}|{}", p.name, p.source);
        seen.insert(key)
    });
    packages.sort_by(|a, b| a.name.cmp(&b.name));
    packages
}

// ── Compiled regexes ──

macro_rules! lazy_re {
    ($name:ident, $pat:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($pat).unwrap());
    };
}

lazy_re!(
    RE_BOTO3,
    r#"(?:boto3|session)\s*\.\s*(?:client|resource)\s*\(\s*['"]([\w-]+)['"]\)"#
);
lazy_re!(RE_CFN, r"AWS::(\w+)::\w+");
lazy_re!(
    RE_TF_AWS,
    r#"(?:resource|data)\s+"aws_([a-z0-9]+)(?:_[a-z0-9]+)*""#
);
lazy_re!(
    RE_TF_AZURERM,
    r#"(?:resource|data)\s+"azurerm_([a-z0-9]+)(?:_[a-z0-9]+)*""#
);
lazy_re!(RE_ARM_NS, r#""(Microsoft\.\w+)"#);
lazy_re!(RE_BICEP_NS, r"'(Microsoft\.\w+)");
lazy_re!(RE_AZURE_PY, r"(?i)azure[_-][\w-]+");
lazy_re!(
    RE_TF_GOOGLE,
    r#"(?:resource|data)\s+"google_([a-z0-9]+)(?:_[a-z0-9]+)*""#
);
lazy_re!(RE_GCP_PY, r"(?i)google-cloud-[\w-]+");
lazy_re!(
    RE_REQUIREMENTS,
    r"^([a-zA-Z0-9_][a-zA-Z0-9._-]*)(?:\[[^\]]*\])?\s*(.*)$"
);
lazy_re!(
    RE_PEP621_DEPS,
    r#"\[project\]\n[\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]"#
);
lazy_re!(
    RE_PEP621_ITEM,
    r#"["'](\w[\w.-]*)(?:\[[^\]]*\])?\s*([^"']*)["']"#
);
lazy_re!(
    RE_POETRY_DEPS,
    r"\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)"
);
lazy_re!(
    RE_POETRY_LINE,
    r#"^(\w[\w.-]*)\s*=\s*(?:["']([^"'\n]*)["']|(\S+))"#
);
lazy_re!(
    RE_OPT_DEPS_PEP621,
    r"\[project\.optional-dependencies(?:\.\w+)?\]([\s\S]*?)(?:\n\[|$)"
);
lazy_re!(
    RE_OPT_DEPS_POETRY,
    r"\[tool\.poetry\.dev-dependencies\]([\s\S]*?)(?:\n\[|$)"
);
lazy_re!(
    RE_PIPFILE_SECTION,
    r"\[(?:packages|dev-packages)\]([\s\S]*?)(?:\n\[|$)"
);
lazy_re!(
    RE_SETUP_PY_REQUIRES,
    r"install_requires\s*=\s*\[([\s\S]*?)\]"
);
lazy_re!(RE_SETUP_CFG_OPTIONS, r"\[options\]([\s\S]*?)(?:\n\[|$)");
lazy_re!(
    RE_SETUP_CFG_IR,
    r"install_requires\s*=\s*([^\n]*(?:\n[ \t]+[^\n]*)*)"
);
lazy_re!(RE_SETUP_CFG_PKG, r"^(\w[\w.-]*)(?:\[[^\]]*\])?\s*(.*)$");
lazy_re!(RE_GO_REQUIRE_BLOCK, r"require\s*\(([\s\S]*?)\)");
lazy_re!(RE_GO_REQUIRE_LINE, r"^\s*(\S+)\s+(\S+)");
lazy_re!(RE_GO_SINGLE_REQUIRE, r"(?m)^require\s+(\S+)\s+(\S+)");
lazy_re!(
    RE_MAVEN_DEP,
    r"<dependency>\s*<groupId>([^<]*)</groupId>\s*<artifactId>([^<]*)</artifactId>(?:\s*<version>([^<]*)</version>)?"
);
lazy_re!(
    RE_GRADLE_DEP,
    r#"(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*[("']([^):'"]+(:[^)'"]*)?)[)"']"#
);
lazy_re!(
    RE_GEM,
    r#"(?m)^\s*gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]*)['"])?"#
);
// Cargo.toml: match [dependencies], [dev-dependencies], [build-dependencies] sections
lazy_re!(RE_CARGO_SECTION, r"(?m)^\[(?:dev-|build-)?dependencies\]");
lazy_re!(RE_CARGO_SIMPLE, r#"^([\w-]+)\s*=\s*"([^"]*)""#);
lazy_re!(
    RE_CARGO_TABLE,
    r#"^([\w-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]*)""#
);

// ── AWS Detection ──

pub fn detect_aws(files: &[FileInput]) -> Vec<DetectedCloudService> {
    let mut results = Vec::new();

    for file in files {
        // JS SDK v3, v2, CDK from package.json
        if file.path.ends_with("package.json") {
            let deps = parse_package_json_deps(&file.content);
            for dep in deps.keys() {
                if let Some(suffix) = dep.strip_prefix("@aws-sdk/client-") {
                    let service = rules::CLIENT_TO_SERVICE
                        .get(suffix)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| title_case(suffix));
                    results.push(DetectedCloudService {
                        service,
                        sdk_package: Some(dep.clone()),
                        source: file.path.clone(),
                        via: "js-sdk-v3".into(),
                    });
                }
                if dep == "aws-sdk" {
                    results.push(DetectedCloudService {
                        service: "AWS SDK v2 (general)".into(),
                        sdk_package: Some("aws-sdk".into()),
                        source: file.path.clone(),
                        via: "js-sdk-v2".into(),
                    });
                }
                if let Some(suffix) = dep
                    .strip_prefix("@aws-cdk/aws-")
                    .or_else(|| dep.strip_prefix("aws-cdk-lib/aws-"))
                {
                    let service = rules::CLIENT_TO_SERVICE
                        .get(suffix)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| title_case(suffix));
                    results.push(DetectedCloudService {
                        service,
                        sdk_package: Some(dep.clone()),
                        source: file.path.clone(),
                        via: "cdk".into(),
                    });
                }
            }
        }

        // boto3 in .py files
        if file.path.ends_with(".py") {
            for cap in RE_BOTO3.captures_iter(&file.content) {
                let svc_id = &cap[1];
                let service = rules::BOTO3_TO_SERVICE
                    .get(svc_id)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| title_case(svc_id));
                results.push(DetectedCloudService {
                    service,
                    sdk_package: Some(format!("boto3:{svc_id}")),
                    source: file.path.clone(),
                    via: "boto3".into(),
                });
            }
        }

        // CloudFormation
        if file.path.ends_with(".yaml")
            || file.path.ends_with(".yml")
            || file.path.ends_with(".json")
            || file.path.ends_with(".template")
        {
            for cap in RE_CFN.captures_iter(&file.content) {
                results.push(DetectedCloudService {
                    service: cap[1].to_string(),
                    sdk_package: None,
                    source: file.path.clone(),
                    via: "cloudformation".into(),
                });
            }
        }

        // Terraform aws_*
        if file.path.ends_with(".tf") {
            for cap in RE_TF_AWS.captures_iter(&file.content) {
                let prefix = &cap[1];
                let service = rules::TF_PREFIX_TO_SERVICE
                    .get(prefix)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| title_case(prefix));
                results.push(DetectedCloudService {
                    service,
                    sdk_package: None,
                    source: file.path.clone(),
                    via: "terraform".into(),
                });
            }
        }
    }

    dedup_cloud(results)
}

// ── Azure Detection ──

pub fn detect_azure(files: &[FileInput]) -> Vec<DetectedCloudService> {
    let mut results = Vec::new();

    for file in files {
        // Terraform azurerm_*
        if file.path.ends_with(".tf") {
            for cap in RE_TF_AZURERM.captures_iter(&file.content) {
                let prefix = &cap[1];
                let service = rules::TF_AZURERM_TO_SERVICE
                    .get(prefix)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| title_case(prefix));
                results.push(DetectedCloudService {
                    service,
                    sdk_package: None,
                    source: file.path.clone(),
                    via: "terraform".into(),
                });
            }
        }

        // ARM templates
        if file.path.ends_with(".json")
            && (file.content.contains("deploymentTemplate") || file.content.contains("Microsoft."))
        {
            for cap in RE_ARM_NS.captures_iter(&file.content) {
                let ns = &cap[1];
                let service = rules::ARM_NAMESPACE_TO_SERVICE
                    .get(ns)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| ns.replace("Microsoft.", ""));
                results.push(DetectedCloudService {
                    service,
                    sdk_package: None,
                    source: file.path.clone(),
                    via: "arm-template".into(),
                });
            }
        }

        // Bicep
        if file.path.ends_with(".bicep") {
            for cap in RE_BICEP_NS.captures_iter(&file.content) {
                let ns = &cap[1];
                let service = rules::ARM_NAMESPACE_TO_SERVICE
                    .get(ns)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| ns.replace("Microsoft.", ""));
                results.push(DetectedCloudService {
                    service,
                    sdk_package: None,
                    source: file.path.clone(),
                    via: "bicep".into(),
                });
            }
        }

        // npm SDK: @azure/*
        if file.path.ends_with("package.json") {
            let deps = parse_package_json_deps(&file.content);
            for dep in deps.keys() {
                if let Some(suffix) = dep.strip_prefix("@azure/") {
                    results.push(DetectedCloudService {
                        service: title_case(suffix),
                        sdk_package: Some(dep.clone()),
                        source: file.path.clone(),
                        via: "npm-sdk".into(),
                    });
                }
            }
        }

        // Python SDK: azure-* or azure_*
        if is_python_manifest(&file.path) {
            for m in RE_AZURE_PY.find_iter(&file.content) {
                let pkg = m.as_str().to_lowercase();
                let suffix = pkg
                    .trim_start_matches("azure-")
                    .trim_start_matches("azure_");
                results.push(DetectedCloudService {
                    service: title_case(suffix),
                    sdk_package: Some(pkg),
                    source: file.path.clone(),
                    via: "python-sdk".into(),
                });
            }
        }
    }

    dedup_cloud(results)
}

// ── GCP Detection ──

pub fn detect_gcp(files: &[FileInput]) -> Vec<DetectedCloudService> {
    let mut results = Vec::new();

    for file in files {
        // Terraform google_*
        if file.path.ends_with(".tf") {
            for cap in RE_TF_GOOGLE.captures_iter(&file.content) {
                let prefix = &cap[1];
                let service = rules::TF_GOOGLE_TO_SERVICE
                    .get(prefix)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| title_case(prefix));
                results.push(DetectedCloudService {
                    service,
                    sdk_package: None,
                    source: file.path.clone(),
                    via: "terraform".into(),
                });
            }
        }

        // npm SDK: @google-cloud/*
        if file.path.ends_with("package.json") {
            let deps = parse_package_json_deps(&file.content);
            for dep in deps.keys() {
                if let Some(suffix) = dep.strip_prefix("@google-cloud/") {
                    let service = rules::TF_GOOGLE_TO_SERVICE
                        .get(suffix)
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| title_case(suffix));
                    results.push(DetectedCloudService {
                        service,
                        sdk_package: Some(dep.clone()),
                        source: file.path.clone(),
                        via: "npm-sdk".into(),
                    });
                }
            }
        }

        // Python SDK: google-cloud-*
        if is_python_manifest(&file.path) {
            for m in RE_GCP_PY.find_iter(&file.content) {
                let pkg = m.as_str().to_lowercase();
                let suffix = pkg.trim_start_matches("google-cloud-");
                let service = rules::TF_GOOGLE_TO_SERVICE
                    .get(suffix)
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| title_case(suffix));
                results.push(DetectedCloudService {
                    service,
                    sdk_package: Some(pkg),
                    source: file.path.clone(),
                    via: "python-sdk".into(),
                });
            }
        }
    }

    dedup_cloud(results)
}

// ── Python Detection ──

pub fn detect_python(files: &[FileInput]) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for file in files {
        let b = basename(&file.path);
        match b {
            "requirements.txt" => results.extend(parse_requirements_txt(&file.path, &file.content)),
            "pyproject.toml" => results.extend(parse_pyproject_toml(&file.path, &file.content)),
            "Pipfile" => results.extend(parse_pipfile(&file.path, &file.content)),
            "setup.py" => results.extend(parse_setup_py(&file.path, &file.content)),
            "setup.cfg" => results.extend(parse_setup_cfg(&file.path, &file.content)),
            _ => {
                if file.path.contains("requirements/") && file.path.ends_with(".txt") {
                    results.extend(parse_requirements_txt(&file.path, &file.content));
                }
            }
        }
    }

    dedup_packages(results)
}

fn parse_requirements_txt(path: &str, content: &str) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with('-') {
            continue;
        }
        if let Some(cap) = RE_REQUIREMENTS.captures(line) {
            let name = cap[1].to_lowercase();
            let version = cap
                .get(2)
                .map(|m| m.as_str().trim().to_string())
                .filter(|v| !v.is_empty());
            results.push(DetectedPackage {
                name,
                version,
                source: path.to_string(),
            });
        }
    }
    results
}

fn parse_pyproject_toml(path: &str, content: &str) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    // PEP 621: [project] dependencies = [...]
    if let Some(cap) = RE_PEP621_DEPS.captures(content) {
        for m in RE_PEP621_ITEM.captures_iter(&cap[1]) {
            let version = m
                .get(2)
                .map(|v| v.as_str().trim().to_string())
                .filter(|v| !v.is_empty());
            results.push(DetectedPackage {
                name: m[1].to_lowercase(),
                version,
                source: path.to_string(),
            });
        }
    }

    // Poetry: [tool.poetry.dependencies]
    if let Some(cap) = RE_POETRY_DEPS.captures(content) {
        for line in cap[1].lines() {
            if let Some(m) = RE_POETRY_LINE.captures(line) {
                if &m[1] == "python" {
                    continue;
                }
                let version = m
                    .get(2)
                    .or(m.get(3))
                    .map(|v| v.as_str().trim().to_string())
                    .filter(|v| !v.is_empty());
                results.push(DetectedPackage {
                    name: m[1].to_lowercase(),
                    version,
                    source: path.to_string(),
                });
            }
        }
    }

    // PEP 621 optional dependencies: [project.optional-dependencies.dev] etc.
    for cap in RE_OPT_DEPS_PEP621.captures_iter(content) {
        for line in cap[1].lines() {
            if let Some(m) = RE_PEP621_ITEM.captures(line) {
                let version = m
                    .get(2)
                    .map(|v| v.as_str().trim().to_string())
                    .filter(|v| !v.is_empty());
                results.push(DetectedPackage {
                    name: m[1].to_lowercase(),
                    version,
                    source: path.to_string(),
                });
            }
        }
    }

    // Poetry dev dependencies: [tool.poetry.dev-dependencies]
    for cap in RE_OPT_DEPS_POETRY.captures_iter(content) {
        for line in cap[1].lines() {
            if let Some(m) = RE_POETRY_LINE.captures(line) {
                if &m[1] == "python" {
                    continue;
                }
                let version = m
                    .get(2)
                    .or(m.get(3))
                    .map(|v| v.as_str().trim().to_string())
                    .filter(|v| !v.is_empty());
                results.push(DetectedPackage {
                    name: m[1].to_lowercase(),
                    version,
                    source: path.to_string(),
                });
            }
        }
    }

    results
}

fn parse_pipfile(path: &str, content: &str) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for cap in RE_PIPFILE_SECTION.captures_iter(content) {
        for line in cap[1].lines() {
            if let Some(m) = RE_POETRY_LINE.captures(line) {
                let raw = m.get(2).or(m.get(3)).map(|v| v.as_str().trim());
                let version = raw
                    .filter(|v| *v != "*" && !v.is_empty())
                    .map(|v| v.to_string());
                results.push(DetectedPackage {
                    name: m[1].to_lowercase(),
                    version,
                    source: path.to_string(),
                });
            }
        }
    }
    results
}

fn parse_setup_py(path: &str, content: &str) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    if let Some(cap) = RE_SETUP_PY_REQUIRES.captures(content) {
        for m in RE_PEP621_ITEM.captures_iter(&cap[1]) {
            let version = m
                .get(2)
                .map(|v| v.as_str().trim().to_string())
                .filter(|v| !v.is_empty());
            results.push(DetectedPackage {
                name: m[1].to_lowercase(),
                version,
                source: path.to_string(),
            });
        }
    }
    results
}

fn parse_setup_cfg(path: &str, content: &str) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    if let Some(options) = RE_SETUP_CFG_OPTIONS.captures(content) {
        if let Some(ir) = RE_SETUP_CFG_IR.captures(&options[1]) {
            for line in ir[1].lines() {
                let line = line.trim();
                if let Some(m) = RE_SETUP_CFG_PKG.captures(line) {
                    if !m[1].is_empty() {
                        let version = m
                            .get(2)
                            .map(|v| v.as_str().trim().to_string())
                            .filter(|v| !v.is_empty());
                        results.push(DetectedPackage {
                            name: m[1].to_lowercase(),
                            version,
                            source: path.to_string(),
                        });
                    }
                }
            }
        }
    }
    results
}

// ── Go Detection ──

pub fn detect_go(files: &[FileInput]) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for file in files {
        if !file.path.ends_with("go.mod") {
            continue;
        }

        // require blocks
        for cap in RE_GO_REQUIRE_BLOCK.captures_iter(&file.content) {
            for line in cap[1].lines() {
                if let Some(m) = RE_GO_REQUIRE_LINE.captures(line) {
                    if !m[1].starts_with("//") {
                        results.push(DetectedPackage {
                            name: m[1].to_string(),
                            version: Some(m[2].to_string()),
                            source: file.path.clone(),
                        });
                    }
                }
            }
        }

        // Single-line requires
        for cap in RE_GO_SINGLE_REQUIRE.captures_iter(&file.content) {
            results.push(DetectedPackage {
                name: cap[1].to_string(),
                version: Some(cap[2].to_string()),
                source: file.path.clone(),
            });
        }
    }

    dedup_packages(results)
}

// ── Java Detection ──

pub fn detect_java(files: &[FileInput]) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for file in files {
        let b = basename(&file.path);

        if b == "pom.xml" {
            for cap in RE_MAVEN_DEP.captures_iter(&file.content) {
                results.push(DetectedPackage {
                    name: format!("{}:{}", &cap[1], &cap[2]),
                    version: cap.get(3).map(|m| m.as_str().to_string()),
                    source: file.path.clone(),
                });
            }
        }

        if b == "build.gradle" || b == "build.gradle.kts" {
            for cap in RE_GRADLE_DEP.captures_iter(&file.content) {
                let parts: Vec<&str> = cap[1].split(':').collect();
                if parts.len() >= 2 {
                    let name = format!("{}:{}", parts[0], parts[1]);
                    let version = parts.get(2).map(|v| v.to_string());
                    results.push(DetectedPackage {
                        name,
                        version,
                        source: file.path.clone(),
                    });
                }
            }
        }
    }

    dedup_packages(results)
}

// ── Node Detection ──

const CLOUD_PREFIXES: &[&str] = &[
    "@aws-sdk/",
    "aws-sdk",
    "@aws-cdk/",
    "aws-cdk-lib",
    "@azure/",
    "@google-cloud/",
];

fn is_cloud_sdk_package(name: &str) -> bool {
    CLOUD_PREFIXES.iter().any(|p| name.starts_with(p))
}

pub fn detect_node(files: &[FileInput]) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for file in files {
        if !file.path.ends_with("package.json") {
            continue;
        }
        let deps = parse_package_json_deps(&file.content);
        for (name, version) in &deps {
            if !is_cloud_sdk_package(name) {
                results.push(DetectedPackage {
                    name: name.clone(),
                    version: if version.is_empty() {
                        None
                    } else {
                        Some(version.clone())
                    },
                    source: file.path.clone(),
                });
            }
        }
    }

    dedup_packages(results)
}

// ── PHP Detection ──

pub fn detect_php(files: &[FileInput]) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for file in files {
        if !file.path.ends_with("composer.json") {
            continue;
        }
        let deps = parse_composer_json_deps(&file.content);
        for (name, version) in &deps {
            if name != "php" && !name.starts_with("ext-") {
                results.push(DetectedPackage {
                    name: name.clone(),
                    version: if version.is_empty() {
                        None
                    } else {
                        Some(version.clone())
                    },
                    source: file.path.clone(),
                });
            }
        }
    }

    dedup_packages(results)
}

// ── Rust Detection ──

pub fn detect_rust(files: &[FileInput]) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for file in files {
        if !file.path.ends_with("Cargo.toml") {
            continue;
        }
        // Split content into dependency sections manually (no lookahead needed)
        let content = &file.content;
        let section_starts: Vec<usize> = RE_CARGO_SECTION
            .find_iter(content)
            .map(|m| m.end())
            .collect();

        for (i, &start) in section_starts.iter().enumerate() {
            let end = if i + 1 < section_starts.len() {
                // Find the start of the next section header (search backwards from next match)
                content[start..]
                    .find("\n[")
                    .map(|p| start + p)
                    .unwrap_or(content.len())
            } else {
                content.len()
            };
            let section = &content[start..end];
            for line in section.lines() {
                if let Some(m) = RE_CARGO_SIMPLE.captures(line) {
                    results.push(DetectedPackage {
                        name: m[1].to_string(),
                        version: Some(m[2].to_string()),
                        source: file.path.clone(),
                    });
                } else if let Some(m) = RE_CARGO_TABLE.captures(line) {
                    results.push(DetectedPackage {
                        name: m[1].to_string(),
                        version: Some(m[2].to_string()),
                        source: file.path.clone(),
                    });
                }
            }
        }
    }

    dedup_packages(results)
}

// ── Ruby Detection ──

pub fn detect_ruby(files: &[FileInput]) -> Vec<DetectedPackage> {
    let mut results = Vec::new();

    for file in files {
        if !file.path.ends_with("Gemfile") {
            continue;
        }
        for cap in RE_GEM.captures_iter(&file.content) {
            results.push(DetectedPackage {
                name: cap[1].to_string(),
                version: cap.get(2).map(|m| m.as_str().to_string()),
                source: file.path.clone(),
            });
        }
    }

    dedup_packages(results)
}

// ── Framework Detection ──

pub fn detect_frameworks(files: &[FileInput]) -> Vec<DetectedFramework> {
    let mut seen = BTreeSet::new();
    let mut results = Vec::new();

    let mut add = |item: DetectedFramework| {
        if seen.insert(item.name.clone()) {
            results.push(item);
        }
    };

    for file in files {
        let b = basename(&file.path);

        // JS/PHP from package.json/composer.json
        if b == "package.json" || b == "composer.json" {
            let deps = if b == "package.json" {
                parse_package_json_deps(&file.content)
            } else {
                parse_composer_json_deps(&file.content)
            };

            let (fw_map, via) = if b == "package.json" {
                (&*rules::JS_FRAMEWORKS, "package.json")
            } else {
                (&*rules::PHP_FRAMEWORKS, "composer.json")
            };

            for (dep, ver) in &deps {
                if let Some(name) = fw_map.get(dep.as_str()) {
                    add(DetectedFramework {
                        name: name.to_string(),
                        version: if ver.is_empty() {
                            None
                        } else {
                            Some(ver.clone())
                        },
                        source: file.path.clone(),
                        via: via.to_string(),
                    });
                }
            }
        }

        // Python frameworks
        if is_python_manifest(&file.path) {
            let lower = file.content.to_lowercase();
            for (pkg, name) in rules::PY_FRAMEWORKS.iter() {
                if lower.contains(pkg) {
                    add(DetectedFramework {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "pip".to_string(),
                    });
                }
            }
        }

        // Ruby
        if b == "Gemfile" {
            for cap in RE_GEM.captures_iter(&file.content) {
                if let Some(name) = rules::RUBY_FRAMEWORKS.get(cap.get(1).unwrap().as_str()) {
                    add(DetectedFramework {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "Gemfile".to_string(),
                    });
                }
            }
        }

        // Java
        if b == "pom.xml" {
            for (key, name) in rules::JAVA_FRAMEWORKS.iter() {
                let artifact = key.split(':').nth(1).unwrap_or(key);
                if file.content.contains(artifact) {
                    add(DetectedFramework {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "Maven".to_string(),
                    });
                }
            }
        }
        if b == "build.gradle" || b == "build.gradle.kts" {
            for (key, name) in rules::JAVA_FRAMEWORKS.iter() {
                if file.content.contains(key) {
                    add(DetectedFramework {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "Gradle".to_string(),
                    });
                }
            }
        }

        // Go
        if b == "go.mod" {
            for (pkg, name) in rules::GO_FRAMEWORKS.iter() {
                if file.content.contains(pkg) {
                    add(DetectedFramework {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "go.mod".to_string(),
                    });
                }
            }
        }

        // Rust
        if b == "Cargo.toml" {
            for (pkg, name) in rules::RUST_FRAMEWORKS.iter() {
                let pattern = format!("(?m)^{}\\s*=", regex::escape(pkg));
                if Regex::new(&pattern)
                    .map(|re| re.is_match(&file.content))
                    .unwrap_or(false)
                {
                    add(DetectedFramework {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "Cargo.toml".to_string(),
                    });
                }
            }
        }
    }

    results.sort_by(|a, b| a.name.cmp(&b.name));
    results
}

// ── Database Detection ──

pub fn detect_databases(files: &[FileInput]) -> Vec<DetectedDatabase> {
    let mut seen = BTreeSet::new();
    let mut results = Vec::new();

    let mut add = |item: DetectedDatabase| {
        if seen.insert(item.name.clone()) {
            results.push(item);
        }
    };

    for file in files {
        let b = basename(&file.path);

        // JS
        if b == "package.json" {
            let deps = parse_package_json_deps(&file.content);
            for (dep, ver) in &deps {
                if let Some(name) = rules::JS_DB_PACKAGES.get(dep.as_str()) {
                    add(DetectedDatabase {
                        name: name.to_string(),
                        version: if ver.is_empty() {
                            None
                        } else {
                            Some(ver.clone())
                        },
                        source: file.path.clone(),
                        via: "npm".to_string(),
                    });
                }
            }
        }

        // Python
        if is_python_manifest(&file.path) {
            let lower = file.content.to_lowercase();
            for (pkg, name) in rules::PY_DB_PACKAGES.iter() {
                if lower.contains(pkg) {
                    add(DetectedDatabase {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "pip".to_string(),
                    });
                }
            }
        }

        // Ruby
        if b == "Gemfile" {
            for cap in RE_GEM.captures_iter(&file.content) {
                if let Some(name) = rules::RUBY_DB_GEMS.get(cap.get(1).unwrap().as_str()) {
                    add(DetectedDatabase {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "Gemfile".to_string(),
                    });
                }
            }
        }

        // PHP
        if b == "composer.json" {
            let deps = parse_composer_json_deps(&file.content);
            for (dep, ver) in &deps {
                if let Some(name) = rules::PHP_DB_PACKAGES.get(dep.as_str()) {
                    add(DetectedDatabase {
                        name: name.to_string(),
                        version: if ver.is_empty() {
                            None
                        } else {
                            Some(ver.clone())
                        },
                        source: file.path.clone(),
                        via: "composer".to_string(),
                    });
                }
            }
        }

        // Java
        if b == "pom.xml" || b == "build.gradle" || b == "build.gradle.kts" {
            let via = if b == "pom.xml" { "Maven" } else { "Gradle" };
            for (artifact, name) in rules::JAVA_DB_ARTIFACTS.iter() {
                if file.content.contains(artifact) {
                    add(DetectedDatabase {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: via.to_string(),
                    });
                }
            }
        }

        // Go
        if b == "go.mod" {
            for (pkg, name) in rules::GO_DB_PACKAGES.iter() {
                if file.content.contains(pkg) {
                    add(DetectedDatabase {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "go.mod".to_string(),
                    });
                }
            }
        }

        // Rust
        if b == "Cargo.toml" {
            for (crate_name, name) in rules::RUST_DB_CRATES.iter() {
                let pattern = format!("(?m)^{}\\s*=", regex::escape(crate_name));
                if Regex::new(&pattern)
                    .map(|re| re.is_match(&file.content))
                    .unwrap_or(false)
                {
                    add(DetectedDatabase {
                        name: name.to_string(),
                        version: None,
                        source: file.path.clone(),
                        via: "Cargo.toml".to_string(),
                    });
                }
            }
        }
    }

    results.sort_by(|a, b| a.name.cmp(&b.name));
    results
}

// ── CI/CD Detection ──

struct CicdPattern {
    pattern: &'static str,
    name: &'static str,
    category: &'static str,
}

const CICD_PATH_PATTERNS: &[CicdPattern] = &[
    CicdPattern {
        pattern: r"^\.github/workflows/.*\.ya?ml$",
        name: "GitHub Actions",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^\.gitlab-ci\.ya?ml$",
        name: "GitLab CI",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^\.circleci/",
        name: "CircleCI",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^Jenkinsfile$",
        name: "Jenkins",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^\.travis\.yml$",
        name: "Travis CI",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^azure-pipelines\.ya?ml$",
        name: "Azure Pipelines",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^bitbucket-pipelines\.yml$",
        name: "Bitbucket Pipelines",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^\.buildkite/",
        name: "Buildkite",
        category: "ci",
    },
    CicdPattern {
        pattern: r"^Dockerfile(\..+)?$",
        name: "Docker",
        category: "container",
    },
    CicdPattern {
        pattern: r"^(.*/)?Dockerfile(\..+)?$",
        name: "Docker",
        category: "container",
    },
    CicdPattern {
        pattern: r"^docker-compose\.ya?ml$",
        name: "Docker Compose",
        category: "container",
    },
    CicdPattern {
        pattern: r"^compose\.ya?ml$",
        name: "Docker Compose",
        category: "container",
    },
    CicdPattern {
        pattern: r"^\.dockerignore$",
        name: "Docker",
        category: "container",
    },
    CicdPattern {
        pattern: r"^(kubernetes|k8s)/",
        name: "Kubernetes",
        category: "orchestration",
    },
    CicdPattern {
        pattern: r"^Chart\.yaml$",
        name: "Helm",
        category: "orchestration",
    },
    CicdPattern {
        pattern: r"^(charts|helm)/.*Chart\.yaml$",
        name: "Helm",
        category: "orchestration",
    },
    CicdPattern {
        pattern: r"^skaffold\.yaml$",
        name: "Skaffold",
        category: "orchestration",
    },
    CicdPattern {
        pattern: r"^Makefile$",
        name: "Make",
        category: "build",
    },
    CicdPattern {
        pattern: r"^Taskfile\.ya?ml$",
        name: "Task",
        category: "build",
    },
    CicdPattern {
        pattern: r"^justfile$",
        name: "Just",
        category: "build",
    },
    CicdPattern {
        pattern: r"^Earthfile$",
        name: "Earthly",
        category: "build",
    },
    CicdPattern {
        pattern: r"^pulumi\.ya?ml$",
        name: "Pulumi",
        category: "iac",
    },
    CicdPattern {
        pattern: r"^Pulumi\.\w+\.ya?ml$",
        name: "Pulumi",
        category: "iac",
    },
    CicdPattern {
        pattern: r"^serverless\.ya?ml$",
        name: "Serverless Framework",
        category: "iac",
    },
    CicdPattern {
        pattern: r"^\.terraform\.lock\.hcl$",
        name: "Terraform",
        category: "iac",
    },
    CicdPattern {
        pattern: r"^terragrunt\.hcl$",
        name: "Terragrunt",
        category: "iac",
    },
];

pub fn detect_cicd(files: &[FileInput]) -> Vec<DetectedCicdTool> {
    let mut seen = BTreeMap::new();

    let compiled: Vec<(Regex, &str, &str)> = CICD_PATH_PATTERNS
        .iter()
        .filter_map(|p| {
            Regex::new(p.pattern)
                .ok()
                .map(|re| (re, p.name, p.category))
        })
        .collect();

    for file in files {
        for (re, name, category) in &compiled {
            if re.is_match(&file.path) && !seen.contains_key(*name) {
                seen.insert(
                    name.to_string(),
                    DetectedCicdTool {
                        name: name.to_string(),
                        source: file.path.clone(),
                        category: category.to_string(),
                    },
                );
            }
        }
    }

    let mut results: Vec<DetectedCicdTool> = seen.into_values().collect();
    results.sort_by(|a, b| a.name.cmp(&b.name));
    results
}

// ── Testing/Quality Detection ──

struct TestingConfigPattern {
    pattern: &'static str,
    name: &'static str,
    category: &'static str,
}

const TESTING_CONFIG_PATTERNS: &[TestingConfigPattern] = &[
    TestingConfigPattern {
        pattern: r"^\.eslintrc(\.(js|cjs|mjs|json|ya?ml))?$",
        name: "ESLint",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^eslint\.config\.(js|cjs|mjs|ts)$",
        name: "ESLint",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^\.prettierrc(\.(js|cjs|mjs|json|ya?ml))?$",
        name: "Prettier",
        category: "formatting",
    },
    TestingConfigPattern {
        pattern: r"^prettier\.config\.(js|cjs|mjs|ts)$",
        name: "Prettier",
        category: "formatting",
    },
    TestingConfigPattern {
        pattern: r"^jest\.config\.(js|cjs|mjs|ts|json)$",
        name: "Jest",
        category: "testing",
    },
    TestingConfigPattern {
        pattern: r"^vitest\.config\.(js|cjs|mjs|ts)$",
        name: "Vitest",
        category: "testing",
    },
    TestingConfigPattern {
        pattern: r"^playwright\.config\.(js|ts)$",
        name: "Playwright",
        category: "e2e",
    },
    TestingConfigPattern {
        pattern: r"^cypress\.config\.(js|ts|cjs|mjs)$",
        name: "Cypress",
        category: "e2e",
    },
    TestingConfigPattern {
        pattern: r"^\.storybook/",
        name: "Storybook",
        category: "testing",
    },
    TestingConfigPattern {
        pattern: r"^biome\.json$",
        name: "Biome",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^\.ruff\.toml$",
        name: "Ruff",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^\.flake8$",
        name: "flake8",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^\.pylintrc$",
        name: "pylint",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^mypy\.ini$",
        name: "mypy",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^\.mypy\.ini$",
        name: "mypy",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^tox\.ini$",
        name: "tox",
        category: "testing",
    },
    TestingConfigPattern {
        pattern: r"^\.rubocop\.yml$",
        name: "RuboCop",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^\.husky/",
        name: "Husky",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^commitlint\.config\.(js|cjs|mjs|ts)$",
        name: "commitlint",
        category: "linting",
    },
    TestingConfigPattern {
        pattern: r"^\.commitlintrc(\.(js|cjs|mjs|json|ya?ml))?$",
        name: "commitlint",
        category: "linting",
    },
];

pub fn detect_testing(files: &[FileInput]) -> Vec<DetectedTestingTool> {
    let mut seen = BTreeMap::new();

    let compiled: Vec<(Regex, &str, &str)> = TESTING_CONFIG_PATTERNS
        .iter()
        .filter_map(|p| {
            Regex::new(p.pattern)
                .ok()
                .map(|re| (re, p.name, p.category))
        })
        .collect();

    for file in files {
        let b = basename(&file.path);

        // Config file patterns
        for (re, name, category) in &compiled {
            if (re.is_match(&file.path) || re.is_match(b)) && !seen.contains_key(*name) {
                seen.insert(
                    name.to_string(),
                    DetectedTestingTool {
                        name: name.to_string(),
                        source: file.path.clone(),
                        via: "config".to_string(),
                        category: category.to_string(),
                    },
                );
            }
        }

        // JS from package.json
        if b == "package.json" {
            let deps = parse_package_json_deps(&file.content);
            for dep in deps.keys() {
                if let Some(tool) = rules::JS_TESTING_PACKAGES.get(dep.as_str()) {
                    if !seen.contains_key(tool.name) {
                        seen.insert(
                            tool.name.to_string(),
                            DetectedTestingTool {
                                name: tool.name.to_string(),
                                source: file.path.clone(),
                                via: "npm".to_string(),
                                category: tool.category.to_string(),
                            },
                        );
                    }
                }
            }
        }

        // Python
        if is_python_manifest(&file.path) {
            let lower = file.content.to_lowercase();
            for (pkg, tool) in rules::PY_TESTING_PACKAGES.iter() {
                if lower.contains(pkg) && !seen.contains_key(tool.name) {
                    seen.insert(
                        tool.name.to_string(),
                        DetectedTestingTool {
                            name: tool.name.to_string(),
                            source: file.path.clone(),
                            via: "pip".to_string(),
                            category: tool.category.to_string(),
                        },
                    );
                }
            }
        }

        // Ruby
        if b == "Gemfile" {
            for cap in RE_GEM.captures_iter(&file.content) {
                if let Some(tool) = rules::RUBY_TESTING_GEMS.get(cap.get(1).unwrap().as_str()) {
                    if !seen.contains_key(tool.name) {
                        seen.insert(
                            tool.name.to_string(),
                            DetectedTestingTool {
                                name: tool.name.to_string(),
                                source: file.path.clone(),
                                via: "Gemfile".to_string(),
                                category: tool.category.to_string(),
                            },
                        );
                    }
                }
            }
        }

        // Java
        if b == "pom.xml" || b == "build.gradle" || b == "build.gradle.kts" {
            let via = if b == "pom.xml" { "Maven" } else { "Gradle" };
            for (artifact, tool) in rules::JAVA_TESTING_ARTIFACTS.iter() {
                if file.content.contains(artifact) && !seen.contains_key(tool.name) {
                    seen.insert(
                        tool.name.to_string(),
                        DetectedTestingTool {
                            name: tool.name.to_string(),
                            source: file.path.clone(),
                            via: via.to_string(),
                            category: tool.category.to_string(),
                        },
                    );
                }
            }
        }

        // Go
        if b == "go.mod" {
            for (pkg, tool) in rules::GO_TESTING_PACKAGES.iter() {
                if file.content.contains(pkg) && !seen.contains_key(tool.name) {
                    seen.insert(
                        tool.name.to_string(),
                        DetectedTestingTool {
                            name: tool.name.to_string(),
                            source: file.path.clone(),
                            via: "go.mod".to_string(),
                            category: tool.category.to_string(),
                        },
                    );
                }
            }
        }
    }

    let mut results: Vec<DetectedTestingTool> = seen.into_values().collect();
    results.sort_by(|a, b| a.name.cmp(&b.name));
    results
}

// ── Language Detection ──

pub fn detect_languages(all_paths: &[String]) -> BTreeMap<String, u64> {
    let mut counts: BTreeMap<String, u64> = BTreeMap::new();

    for path in all_paths {
        if let Some(ext) = path.rsplit('.').next() {
            if let Some(lang) = rules::LANG_EXTENSIONS.get(ext) {
                *counts.entry(lang.to_string()).or_default() += 1;
            }
        }
    }

    counts
}

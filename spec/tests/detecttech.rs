//! Integration tests for the `detect-tech` command.
//!
//! Each test creates a transient git repo with specific file structures
//! and verifies that the detection engine finds the expected technologies.

mod common;

use std::path::Path;

use gix::date::parse::TimeBuf;
use gix::objs;

// ── Repo builder helper ──

/// Create a git repo at `dir/name` with a single commit containing
/// the given files. Files are specified as (path, content) pairs.
/// Paths may contain "/" for nested directories.
fn create_tech_repo(
    dir: &Path,
    name: &str,
    files: &[(&str, &str)],
) -> anyhow::Result<std::path::PathBuf> {
    let repo_path = dir.join(name);
    std::fs::create_dir_all(&repo_path)?;
    let repo = gix::init(&repo_path)?;

    // Write blobs and collect entries
    let mut entries: Vec<(&str, gix::ObjectId)> = Vec::new();
    for (path, content) in files {
        let blob = repo.write_blob(content.as_bytes())?.detach();
        entries.push((path, blob));
    }

    // Build nested tree
    let tree_oid = common::fixture::write_nested_tree(&repo, &entries)?;

    // Create commit
    let sig = gix::actor::Signature {
        name: "Test".into(),
        email: "test@example.com".into(),
        time: gix::date::Time::new(1_700_000_000, 0),
    };
    let mut buf = TimeBuf::default();
    let sig_ref = sig.to_ref(&mut buf);
    let commit = objs::Commit {
        tree: tree_oid,
        parents: smallvec::smallvec![],
        author: sig_ref.into(),
        committer: sig_ref.into(),
        encoding: None,
        message: "initial".into(),
        extra_headers: vec![],
    };
    let commit_oid = repo.write_object(&commit)?.detach();

    repo.reference(
        "refs/heads/main",
        commit_oid,
        gix::refs::transaction::PreviousValue::Any,
        "main",
    )?;
    repo.reference(
        "HEAD",
        commit_oid,
        gix::refs::transaction::PreviousValue::Any,
        "HEAD",
    )?;

    Ok(repo_path)
}

/// Run detect-tech on a repo and return the parsed JSON result.
fn detect(repo_path: &Path) -> repoanalyze::techdetect::types::TechDetectResult {
    repoanalyze::techdetect::run_detect_tech(repo_path).expect("detect-tech should succeed")
}

// ── Language Detection ──

#[test]
fn detects_languages_by_extension() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "lang-repo",
        &[
            ("src/main.rs", "fn main() {}"),
            ("src/lib.rs", "pub mod foo;"),
            ("app/index.ts", "console.log('hi')"),
            ("app/utils.ts", "export const x = 1"),
            ("app/style.css", "body {}"),
            ("script.py", "print('hello')"),
            ("README.md", "# Readme"),
        ],
    )
    .unwrap();

    let result = detect(&repo);
    assert_eq!(result.languages["Rust"], 2);
    assert_eq!(result.languages["TypeScript"], 2);
    assert_eq!(result.languages["CSS"], 1);
    assert_eq!(result.languages["Python"], 1);
    assert_eq!(result.languages["Markdown"], 1);
    assert_eq!(result.total_files, 7);
}

// ── Node.js / package.json ──

#[test]
fn detects_node_packages_and_frameworks() {
    let pkg = r#"{
        "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "next": "14.0.0",
            "pg": "^8.11.0",
            "redis": "^4.6.0"
        },
        "devDependencies": {
            "jest": "^29.0.0",
            "eslint": "^8.50.0",
            "prettier": "^3.0.0",
            "@playwright/test": "^1.40.0"
        }
    }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "node-repo",
        &[
            ("package.json", pkg),
            ("src/index.ts", "import React from 'react'"),
        ],
    )
    .unwrap();

    let result = detect(&repo);

    // Frameworks
    let fw_names: Vec<&str> = result.frameworks.iter().map(|f| f.name.as_str()).collect();
    assert!(fw_names.contains(&"React"), "should detect React");
    assert!(fw_names.contains(&"Next.js"), "should detect Next.js");

    // Databases
    let db_names: Vec<&str> = result.databases.iter().map(|d| d.name.as_str()).collect();
    assert!(db_names.contains(&"PostgreSQL"), "should detect PostgreSQL");
    assert!(db_names.contains(&"Redis"), "should detect Redis");

    // Testing
    let test_names: Vec<&str> = result.testing.iter().map(|t| t.name.as_str()).collect();
    assert!(test_names.contains(&"Jest"), "should detect Jest");
    assert!(test_names.contains(&"ESLint"), "should detect ESLint");
    assert!(test_names.contains(&"Prettier"), "should detect Prettier");
    assert!(
        test_names.contains(&"Playwright"),
        "should detect Playwright"
    );

    // Node packages (non-cloud)
    assert!(result
        .node
        .iter()
        .any(|p| p.name == "react" && p.version.as_deref() == Some("^18.2.0")));
    assert!(result.node.iter().any(|p| p.name == "jest"));
}

// ── AWS Detection (JS SDK v3 + Terraform) ──

#[test]
fn detects_aws_services() {
    let pkg = r#"{
        "dependencies": {
            "@aws-sdk/client-s3": "^3.400.0",
            "@aws-sdk/client-dynamodb": "^3.400.0",
            "@aws-sdk/client-lambda": "^3.400.0"
        }
    }"#;

    let tf = r#"
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
}

resource "aws_lambda_function" "handler" {
  function_name = "my-func"
}

data "aws_iam_role" "example" {
  name = "my-role"
}
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "aws-repo",
        &[("package.json", pkg), ("infra/main.tf", tf)],
    )
    .unwrap();

    let result = detect(&repo);
    let services: Vec<&str> = result.aws.iter().map(|s| s.service.as_str()).collect();
    assert!(services.contains(&"S3"), "should detect S3");
    assert!(services.contains(&"DynamoDB"), "should detect DynamoDB");
    assert!(services.contains(&"Lambda"), "should detect Lambda");
    assert!(
        services.contains(&"IAM"),
        "should detect IAM from Terraform"
    );

    // Verify via methods
    assert!(result
        .aws
        .iter()
        .any(|s| s.via == "js-sdk-v3" && s.service == "S3"));
    assert!(result
        .aws
        .iter()
        .any(|s| s.via == "terraform" && s.service == "S3"));
}

#[test]
fn detects_aws_sdk_v2() {
    let pkg = r#"{ "dependencies": { "aws-sdk": "^2.1400.0" } }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "aws-v2", &[("package.json", pkg)]).unwrap();

    let result = detect(&repo);
    assert!(result
        .aws
        .iter()
        .any(|s| s.via == "js-sdk-v2" && s.service == "AWS SDK v2 (general)"));
}

#[test]
fn detects_aws_cdk() {
    let pkg =
        r#"{ "dependencies": { "@aws-cdk/aws-s3": "^2.0.0", "@aws-cdk/aws-lambda": "^2.0.0" } }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "aws-cdk", &[("package.json", pkg)]).unwrap();

    let result = detect(&repo);
    assert!(result
        .aws
        .iter()
        .any(|s| s.via == "cdk" && s.service == "S3"));
    assert!(result
        .aws
        .iter()
        .any(|s| s.via == "cdk" && s.service == "Lambda"));
}

#[test]
fn detects_boto3_in_python() {
    let py = r#"
import boto3
client = boto3.client('s3')
dynamo = boto3.resource('dynamodb')
session.client('lambda')
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "boto3", &[("app.py", py)]).unwrap();

    let result = detect(&repo);
    let services: Vec<&str> = result.aws.iter().map(|s| s.service.as_str()).collect();
    assert!(services.contains(&"S3"), "should detect S3 via boto3");
    assert!(
        services.contains(&"DynamoDB"),
        "should detect DynamoDB via boto3"
    );
    assert!(
        services.contains(&"Lambda"),
        "should detect Lambda via boto3"
    );
    assert!(result.aws.iter().all(|s| s.via == "boto3"));
}

#[test]
fn detects_cloudformation() {
    let cfn = r#"
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyBucket:
    Type: AWS::S3::Bucket
  MyQueue:
    Type: AWS::SQS::Queue
  MyTopic:
    Type: AWS::SNS::Topic
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "cfn", &[("template.yaml", cfn)]).unwrap();

    let result = detect(&repo);
    let services: Vec<&str> = result.aws.iter().map(|s| s.service.as_str()).collect();
    assert!(services.contains(&"S3"));
    assert!(services.contains(&"SQS"));
    assert!(services.contains(&"SNS"));
}

// ── Azure Detection ──

#[test]
fn detects_azure_terraform() {
    let tf = r#"
resource "azurerm_storage_account" "example" {
  name = "storageacct"
}

resource "azurerm_kubernetes_cluster" "aks" {
  name = "aks-cluster"
}

resource "azurerm_cosmosdb_account" "db" {
  name = "cosmos"
}
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "azure-tf", &[("infra/main.tf", tf)]).unwrap();

    let result = detect(&repo);
    let services: Vec<&str> = result.azure.iter().map(|s| s.service.as_str()).collect();
    assert!(services.contains(&"Storage"));
    assert!(services.contains(&"AKS"));
    assert!(services.contains(&"Cosmos DB"));
}

#[test]
fn detects_azure_arm_templates() {
    let arm = r#"{
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        "resources": [
            { "type": "Microsoft.Compute/virtualMachines" },
            { "type": "Microsoft.Storage/storageAccounts" }
        ]
    }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "azure-arm", &[("azuredeploy.json", arm)]).unwrap();

    let result = detect(&repo);
    let services: Vec<&str> = result.azure.iter().map(|s| s.service.as_str()).collect();
    assert!(services.contains(&"Virtual Machines"));
    assert!(services.contains(&"Storage"));
}

#[test]
fn detects_azure_npm_sdk() {
    let pkg =
        r#"{ "dependencies": { "@azure/storage-blob": "^12.0.0", "@azure/identity": "^3.0.0" } }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "azure-npm", &[("package.json", pkg)]).unwrap();

    let result = detect(&repo);
    assert!(result.azure.iter().any(|s| s.via == "npm-sdk"));
    assert!(result.azure.len() >= 2);
}

// ── GCP Detection ──

#[test]
fn detects_gcp_terraform() {
    let tf = r#"
resource "google_storage_bucket" "bucket" {
  name = "my-bucket"
}

resource "google_bigquery_dataset" "ds" {
  dataset_id = "my_dataset"
}

resource "google_pubsub_topic" "topic" {
  name = "my-topic"
}
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "gcp-tf", &[("infra/main.tf", tf)]).unwrap();

    let result = detect(&repo);
    let services: Vec<&str> = result.gcp.iter().map(|s| s.service.as_str()).collect();
    assert!(services.contains(&"Cloud Storage"));
    assert!(services.contains(&"BigQuery"));
    assert!(services.contains(&"Pub/Sub"));
}

#[test]
fn detects_gcp_npm_sdk() {
    let pkg = r#"{ "dependencies": { "@google-cloud/storage": "^7.0.0", "@google-cloud/pubsub": "^4.0.0" } }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "gcp-npm", &[("package.json", pkg)]).unwrap();

    let result = detect(&repo);
    assert!(result.gcp.iter().any(|s| s.service == "Cloud Storage"));
    assert!(result.gcp.iter().any(|s| s.service == "Pub/Sub"));
}

// ── Python Detection ──

#[test]
fn detects_python_requirements_txt() {
    let req = "django>=4.2\ncelery==5.3.0\npsycopg2-binary>=2.9\nredis\npytest\n";

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "py-req", &[("requirements.txt", req)]).unwrap();

    let result = detect(&repo);
    assert!(result.python.iter().any(|p| p.name == "django"));
    assert!(result
        .python
        .iter()
        .any(|p| p.name == "celery" && p.version.as_deref() == Some("==5.3.0")));

    // Framework detection
    assert!(result.frameworks.iter().any(|f| f.name == "Django"));
    assert!(result.frameworks.iter().any(|f| f.name == "Celery"));

    // Database detection
    assert!(result.databases.iter().any(|d| d.name == "PostgreSQL"));
    assert!(result.databases.iter().any(|d| d.name == "Redis"));

    // Testing detection
    assert!(result.testing.iter().any(|t| t.name == "pytest"));
}

#[test]
fn detects_python_pyproject_toml() {
    let pyproject = r#"
[project]
name = "myapp"
dependencies = [
    "fastapi>=0.100.0",
    "sqlalchemy>=2.0",
]

[tool.poetry.dependencies]
python = "^3.11"
flask = "^2.3"

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "ruff>=0.1.0",
]
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo =
        create_tech_repo(tmp.path(), "py-pyproject", &[("pyproject.toml", pyproject)]).unwrap();

    let result = detect(&repo);
    assert!(result.python.iter().any(|p| p.name == "fastapi"));
    assert!(result.python.iter().any(|p| p.name == "sqlalchemy"));
    assert!(result.python.iter().any(|p| p.name == "flask"));
    assert!(result.python.iter().any(|p| p.name == "pytest"));
    assert!(result.python.iter().any(|p| p.name == "ruff"));

    assert!(result.frameworks.iter().any(|f| f.name == "FastAPI"));
    assert!(result.frameworks.iter().any(|f| f.name == "Flask"));
}

#[test]
fn detects_python_pipfile() {
    let pipfile = r#"
[packages]
django = "==4.2"
celery = "*"
pymongo = ">=4.0"

[dev-packages]
black = "*"
mypy = ">=1.0"
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "py-pipfile", &[("Pipfile", pipfile)]).unwrap();

    let result = detect(&repo);
    assert!(result
        .python
        .iter()
        .any(|p| p.name == "django" && p.version.as_deref() == Some("==4.2")));
    assert!(result.python.iter().any(|p| p.name == "pymongo"));
    // * versions should have no version
    assert!(result
        .python
        .iter()
        .any(|p| p.name == "celery" && p.version.is_none()));

    assert!(result.databases.iter().any(|d| d.name == "MongoDB"));
    assert!(result.testing.iter().any(|t| t.name == "Black"));
    assert!(result.testing.iter().any(|t| t.name == "mypy"));
}

// ── Go Detection ──

#[test]
fn detects_go_modules() {
    let gomod = r#"module github.com/example/app

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/jackc/pgx/v5 v5.4.3
    github.com/redis/go-redis/v9 v9.2.1
    github.com/stretchr/testify v1.8.4
)

require github.com/onsi/ginkgo v1.16.5
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "go-repo", &[("go.mod", gomod)]).unwrap();

    let result = detect(&repo);
    assert!(result
        .go
        .iter()
        .any(|p| p.name == "github.com/gin-gonic/gin"));

    assert!(result.frameworks.iter().any(|f| f.name == "Gin"));
    assert!(result.databases.iter().any(|d| d.name == "PostgreSQL"));
    assert!(result.databases.iter().any(|d| d.name == "Redis"));
    assert!(result.testing.iter().any(|t| t.name == "Testify"));
    assert!(result.testing.iter().any(|t| t.name == "Ginkgo"));
}

// ── Java Detection ──

#[test]
fn detects_java_maven() {
    let pom = r#"<?xml version="1.0"?>
<project>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
            <version>3.1.0</version>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <version>42.6.0</version>
        </dependency>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
        </dependency>
    </dependencies>
</project>"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "java-maven", &[("pom.xml", pom)]).unwrap();

    let result = detect(&repo);
    assert!(result
        .java
        .iter()
        .any(|p| p.name == "org.springframework.boot:spring-boot-starter-web"));
    assert!(result.frameworks.iter().any(|f| f.name == "Spring Boot"));
    assert!(result.databases.iter().any(|d| d.name == "PostgreSQL"));
    assert!(result.testing.iter().any(|t| t.name == "JUnit"));
}

#[test]
fn detects_java_gradle() {
    let gradle = r#"
plugins {
    id 'java'
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter:3.1.0'
    implementation 'redis.clients:jedis:4.4.3'
    testImplementation 'org.mockito:mockito-core:5.4.0'
}
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "java-gradle", &[("build.gradle", gradle)]).unwrap();

    let result = detect(&repo);
    assert!(result.java.len() >= 2);
    assert!(result.frameworks.iter().any(|f| f.name == "Spring Boot"));
    assert!(result.databases.iter().any(|d| d.name == "Redis"));
    assert!(result.testing.iter().any(|t| t.name == "Mockito"));
}

// ── PHP Detection ──

#[test]
fn detects_php_composer() {
    let composer = r#"{
        "require": {
            "php": "^8.1",
            "laravel/framework": "^10.0",
            "doctrine/orm": "^2.16",
            "predis/predis": "^2.2"
        },
        "require-dev": {
            "phpunit/phpunit": "^10.0"
        }
    }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "php-repo", &[("composer.json", composer)]).unwrap();

    let result = detect(&repo);
    // php and ext-* should be filtered out
    assert!(!result.php.iter().any(|p| p.name == "php"));
    assert!(result.php.iter().any(|p| p.name == "laravel/framework"));

    assert!(result.frameworks.iter().any(|f| f.name == "Laravel"));
    assert!(result.databases.iter().any(|d| d.name == "Doctrine"));
    assert!(result.databases.iter().any(|d| d.name == "Redis"));
}

// ── Rust Detection ──

#[test]
fn detects_rust_cargo_toml() {
    let cargo = r#"
[package]
name = "myapp"
version = "0.1.0"

[dependencies]
axum = "0.7"
sqlx = { version = "0.7", features = ["postgres"] }
redis = "0.23"
serde = { version = "1", features = ["derive"] }

[dev-dependencies]
tokio-test = "0.4"
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "rust-repo", &[("Cargo.toml", cargo)]).unwrap();

    let result = detect(&repo);
    assert!(result
        .rust
        .iter()
        .any(|p| p.name == "axum" && p.version.as_deref() == Some("0.7")));
    assert!(result
        .rust
        .iter()
        .any(|p| p.name == "sqlx" && p.version.as_deref() == Some("0.7")));
    assert!(result
        .rust
        .iter()
        .any(|p| p.name == "serde" && p.version.as_deref() == Some("1")));
    assert!(result.rust.iter().any(|p| p.name == "tokio-test"));

    assert!(result.frameworks.iter().any(|f| f.name == "Axum"));
    assert!(result.databases.iter().any(|d| d.name == "SQLx"));
    assert!(result.databases.iter().any(|d| d.name == "Redis"));
}

// ── Ruby Detection ──

#[test]
fn detects_ruby_gemfile() {
    let gemfile = r#"
source 'https://rubygems.org'

gem 'rails', '~> 7.0'
gem 'pg', '>= 1.5'
gem 'redis', '~> 5.0'
gem 'rspec-rails', group: :test
gem 'rubocop'
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "ruby-repo", &[("Gemfile", gemfile)]).unwrap();

    let result = detect(&repo);
    assert!(result.ruby.iter().any(|p| p.name == "rails"));
    assert!(result.ruby.iter().any(|p| p.name == "pg"));

    assert!(result.frameworks.iter().any(|f| f.name == "Rails"));
    assert!(result.databases.iter().any(|d| d.name == "PostgreSQL"));
    assert!(result.databases.iter().any(|d| d.name == "Redis"));
    assert!(result.testing.iter().any(|t| t.name == "RSpec"));
    assert!(result.testing.iter().any(|t| t.name == "RuboCop"));
}

// ── CI/CD Detection ──

#[test]
fn detects_cicd_tools() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "cicd-repo",
        &[
            (".github/workflows/ci.yml", "name: CI\non: push"),
            ("Dockerfile", "FROM node:18\nCOPY . ."),
            ("docker-compose.yml", "version: '3'\nservices: {}"),
            ("Makefile", "all:\n\techo hello"),
            ("Jenkinsfile", "pipeline { agent any }"),
            (".terraform.lock.hcl", "provider \"aws\" {}"),
            ("kubernetes/deployment.yaml", "apiVersion: apps/v1"),
        ],
    )
    .unwrap();

    let result = detect(&repo);
    let names: Vec<&str> = result.cicd.iter().map(|c| c.name.as_str()).collect();
    assert!(names.contains(&"GitHub Actions"));
    assert!(names.contains(&"Docker"));
    assert!(names.contains(&"Docker Compose"));
    assert!(names.contains(&"Make"));
    assert!(names.contains(&"Jenkins"));
    assert!(names.contains(&"Terraform"));
    assert!(names.contains(&"Kubernetes"));

    // Verify categories
    assert!(result
        .cicd
        .iter()
        .any(|c| c.name == "Docker" && c.category == "container"));
    assert!(result
        .cicd
        .iter()
        .any(|c| c.name == "GitHub Actions" && c.category == "ci"));
    assert!(result
        .cicd
        .iter()
        .any(|c| c.name == "Make" && c.category == "build"));
    assert!(result
        .cicd
        .iter()
        .any(|c| c.name == "Terraform" && c.category == "iac"));
    assert!(result
        .cicd
        .iter()
        .any(|c| c.name == "Kubernetes" && c.category == "orchestration"));
}

// ── Testing/Quality Detection via config files ──

#[test]
fn detects_testing_from_config_files() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "testing-config-repo",
        &[
            ("jest.config.ts", "export default {}"),
            ("playwright.config.ts", "export default {}"),
            (".eslintrc.json", "{}"),
            (".prettierrc", "{}"),
            (".storybook/main.ts", "export default {}"),
            ("vitest.config.ts", "export default {}"),
            (".husky/pre-commit", "#!/bin/sh"),
            ("commitlint.config.js", "module.exports = {}"),
            ("biome.json", "{}"),
            (".ruff.toml", "[tool.ruff]"),
            ("mypy.ini", "[mypy]"),
            ("tox.ini", "[tox]"),
            (".rubocop.yml", "AllCops: {}"),
        ],
    )
    .unwrap();

    let result = detect(&repo);
    let names: Vec<&str> = result.testing.iter().map(|t| t.name.as_str()).collect();
    assert!(names.contains(&"Jest"));
    assert!(names.contains(&"Playwright"));
    assert!(names.contains(&"ESLint"));
    assert!(names.contains(&"Prettier"));
    assert!(names.contains(&"Storybook"));
    assert!(names.contains(&"Vitest"));
    assert!(names.contains(&"Husky"));
    assert!(names.contains(&"commitlint"));
    assert!(names.contains(&"Biome"));
    assert!(names.contains(&"Ruff"));
    assert!(names.contains(&"mypy"));
    assert!(names.contains(&"tox"));
    assert!(names.contains(&"RuboCop"));

    // All should be via "config"
    assert!(result.testing.iter().all(|t| t.via == "config"));
}

// ── Multi-ecosystem repo ──

#[test]
fn detects_multi_ecosystem_monorepo() {
    let node_pkg = r#"{
        "dependencies": {
            "react": "^18.2.0",
            "@aws-sdk/client-s3": "^3.400.0",
            "pg": "^8.11.0"
        },
        "devDependencies": { "vitest": "^1.0.0" }
    }"#;

    let py_req = "django>=4.2\npsycopg2-binary\nboto3\n";

    let go_mod = r#"module github.com/example/svc
go 1.21
require (
    github.com/gin-gonic/gin v1.9.1
    github.com/go-redis/redis/v9 v9.2.1
)
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "monorepo",
        &[
            ("frontend/package.json", node_pkg),
            ("backend/requirements.txt", py_req),
            ("services/go.mod", go_mod),
            ("infra/main.tf", r#"resource "aws_ecs_cluster" "c" {}"#),
            (".github/workflows/ci.yml", "on: push"),
            ("Dockerfile", "FROM node:18"),
            ("frontend/src/App.tsx", "export default () => <div/>"),
            (
                "backend/app.py",
                "import boto3\nclient = boto3.client('sqs')",
            ),
        ],
    )
    .unwrap();

    let result = detect(&repo);

    // Cloud
    assert!(result.aws.iter().any(|s| s.service == "S3"));
    assert!(result
        .aws
        .iter()
        .any(|s| s.service == "SQS" && s.via == "boto3"));
    assert!(result
        .aws
        .iter()
        .any(|s| s.service == "ECS" && s.via == "terraform"));

    // Frameworks
    assert!(result.frameworks.iter().any(|f| f.name == "React"));
    assert!(result.frameworks.iter().any(|f| f.name == "Django"));
    assert!(result.frameworks.iter().any(|f| f.name == "Gin"));

    // Databases
    assert!(result.databases.iter().any(|d| d.name == "PostgreSQL"));
    assert!(result.databases.iter().any(|d| d.name == "Redis"));

    // Languages
    assert!(result.languages.contains_key("TypeScript"));
    assert!(result.languages.contains_key("Python"));

    // CI/CD
    assert!(result.cicd.iter().any(|c| c.name == "GitHub Actions"));
    assert!(result.cicd.iter().any(|c| c.name == "Docker"));

    // Testing
    assert!(result.testing.iter().any(|t| t.name == "Vitest"));

    // Packages from each ecosystem
    assert!(!result.node.is_empty());
    assert!(!result.python.is_empty());
    assert!(!result.go.is_empty());

    // Manifest files analyzed
    assert!(result
        .manifest_files
        .iter()
        .any(|f| f.contains("package.json")));
    assert!(result
        .manifest_files
        .iter()
        .any(|f| f.contains("requirements.txt")));
    assert!(result.manifest_files.iter().any(|f| f.contains("go.mod")));
}

// ── Cloud SDK exclusion from Node packages ──

#[test]
fn excludes_cloud_sdks_from_node_packages() {
    let pkg = r#"{
        "dependencies": {
            "@aws-sdk/client-s3": "^3.400.0",
            "@azure/storage-blob": "^12.0.0",
            "@google-cloud/storage": "^7.0.0",
            "express": "^4.18.0"
        }
    }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "cloud-filter", &[("package.json", pkg)]).unwrap();

    let result = detect(&repo);
    // Cloud SDKs should NOT appear in node packages
    assert!(!result.node.iter().any(|p| p.name.starts_with("@aws-sdk")));
    assert!(!result.node.iter().any(|p| p.name.starts_with("@azure/")));
    assert!(!result
        .node
        .iter()
        .any(|p| p.name.starts_with("@google-cloud/")));
    // express should be in node packages
    assert!(result.node.iter().any(|p| p.name == "express"));
    // But cloud services should be detected
    assert!(!result.aws.is_empty());
    assert!(!result.azure.is_empty());
    assert!(!result.gcp.is_empty());
}

// ── CLI integration (text + json formats) ──

#[test]
fn cli_detect_tech_text_format() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "cli-text",
        &[
            (
                "Cargo.toml",
                "[package]\nname = \"test\"\n[dependencies]\naxum = \"0.7\"\n",
            ),
            ("src/main.rs", "fn main() {}"),
        ],
    )
    .unwrap();

    common::cmd()
        .args(["detect-tech", "--repo"])
        .arg(&repo)
        .assert()
        .success()
        .stdout(predicates::str::contains("Technology Detection Report"))
        .stdout(predicates::str::contains("Rust"))
        .stdout(predicates::str::contains("Axum"));
}

#[test]
fn cli_detect_tech_json_format() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "cli-json",
        &[
            ("package.json", r#"{"dependencies":{"react":"^18.0.0"}}"#),
            ("src/App.tsx", "export default () => <div/>"),
        ],
    )
    .unwrap();

    let output = common::cmd()
        .args(["detect-tech", "--repo"])
        .arg(&repo)
        .args(["--format", "json"])
        .output()
        .expect("should run");

    assert!(output.status.success());
    let result: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("should be valid JSON");
    assert!(result["frameworks"]
        .as_array()
        .unwrap()
        .iter()
        .any(|f| f["name"] == "React"));
    assert!(result["languages"]["TypeScript"].as_u64().unwrap() >= 1);
}

// ── Empty repo ──

#[test]
fn handles_empty_repo() {
    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "empty-repo", &[("README.md", "# Empty")]).unwrap();

    let result = detect(&repo);
    assert!(result.aws.is_empty());
    assert!(result.azure.is_empty());
    assert!(result.gcp.is_empty());
    assert!(result.frameworks.is_empty());
    assert!(result.databases.is_empty());
    assert!(result.cicd.is_empty());
    assert!(result.testing.is_empty());
    assert_eq!(result.total_files, 1);
    assert_eq!(result.languages["Markdown"], 1);
}

// ── Deduplication ──

#[test]
fn deduplicates_cloud_services() {
    let pkg = r#"{
        "dependencies": {
            "@aws-sdk/client-s3": "^3.400.0"
        }
    }"#;
    let tf = r#"resource "aws_s3_bucket" "b" { bucket = "test" }"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(
        tmp.path(),
        "dedup-cloud",
        &[("package.json", pkg), ("infra/main.tf", tf)],
    )
    .unwrap();

    let result = detect(&repo);
    // S3 should appear twice (different via methods) but each unique by service|via|source
    let s3_entries: Vec<_> = result.aws.iter().filter(|s| s.service == "S3").collect();
    assert_eq!(s3_entries.len(), 2); // js-sdk-v3 + terraform
    assert!(s3_entries.iter().any(|s| s.via == "js-sdk-v3"));
    assert!(s3_entries.iter().any(|s| s.via == "terraform"));
}

// ── GCP Python SDK ──

#[test]
fn detects_gcp_python_sdk() {
    let req = "google-cloud-storage>=2.0\ngoogle-cloud-bigquery>=3.0\nflask\n";

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "gcp-py", &[("requirements.txt", req)]).unwrap();

    let result = detect(&repo);
    assert!(result
        .gcp
        .iter()
        .any(|s| s.service == "Cloud Storage" && s.via == "python-sdk"));
    assert!(result
        .gcp
        .iter()
        .any(|s| s.via == "python-sdk" && s.service.contains("BigQuery")));
}

// ── Azure Python SDK ──

#[test]
fn detects_azure_python_sdk() {
    let req = "azure-storage-blob>=12.0\nazure-identity>=1.0\ndjango\n";

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "azure-py", &[("requirements.txt", req)]).unwrap();

    let result = detect(&repo);
    assert!(result.azure.iter().any(|s| s.via == "python-sdk"));
    assert!(result.azure.len() >= 2);
}

// ── Bicep Detection ──

#[test]
fn detects_azure_bicep() {
    let bicep = r#"
resource storageAccount 'Microsoft.Storage/storageAccounts@2021-02-01' = {
  name: 'myStorage'
}
resource keyVault 'Microsoft.KeyVault/vaults@2021-06-01-preview' = {
  name: 'myKV'
}
"#;

    let tmp = tempfile::tempdir().unwrap();
    let repo = create_tech_repo(tmp.path(), "bicep", &[("main.bicep", bicep)]).unwrap();

    let result = detect(&repo);
    let services: Vec<&str> = result.azure.iter().map(|s| s.service.as_str()).collect();
    assert!(services.contains(&"Storage"));
    assert!(services.contains(&"Key Vault"));
    assert!(result.azure.iter().all(|s| s.via == "bicep"));
}

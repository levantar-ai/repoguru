//! Static mapping tables for technology detection.
//! Mirrors the tables in repoguru's techDetectEngine.ts.

use std::collections::BTreeMap;
use std::sync::LazyLock;

macro_rules! map {
    ($($key:expr => $val:expr),* $(,)?) => {{
        let mut m = BTreeMap::new();
        $(m.insert($key, $val);)*
        m
    }};
}

// ── AWS client-* suffix → friendly service name ──

pub static CLIENT_TO_SERVICE: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "s3" => "S3",
        "dynamodb" => "DynamoDB",
        "lambda" => "Lambda",
        "sqs" => "SQS",
        "sns" => "SNS",
        "ses" => "SES",
        "sesv2" => "SES v2",
        "iam" => "IAM",
        "sts" => "STS",
        "cloudwatch" => "CloudWatch",
        "cloudwatch-logs" => "CloudWatch Logs",
        "cloudformation" => "CloudFormation",
        "ec2" => "EC2",
        "ecs" => "ECS",
        "ecr" => "ECR",
        "eks" => "EKS",
        "rds" => "RDS",
        "elasticache" => "ElastiCache",
        "kinesis" => "Kinesis",
        "firehose" => "Firehose",
        "stepfunctions" => "Step Functions",
        "sfn" => "Step Functions",
        "apigateway" => "API Gateway",
        "apigatewayv2" => "API Gateway v2",
        "cognito-identity" => "Cognito Identity",
        "cognito-identity-provider" => "Cognito User Pools",
        "secrets-manager" => "Secrets Manager",
        "ssm" => "Systems Manager",
        "kms" => "KMS",
        "route-53" => "Route 53",
        "cloudfront" => "CloudFront",
        "eventbridge" => "EventBridge",
        "athena" => "Athena",
        "glue" => "Glue",
        "redshift" => "Redshift",
        "elasticsearch-service" => "OpenSearch",
        "opensearch" => "OpenSearch",
        "auto-scaling" => "Auto Scaling",
        "elb" => "ELB",
        "elastic-load-balancing-v2" => "ELB v2",
        "codebuild" => "CodeBuild",
        "codepipeline" => "CodePipeline",
        "codecommit" => "CodeCommit",
        "codedeploy" => "CodeDeploy",
        "textract" => "Textract",
        "rekognition" => "Rekognition",
        "comprehend" => "Comprehend",
        "translate" => "Translate",
        "polly" => "Polly",
        "sagemaker" => "SageMaker",
        "bedrock" => "Bedrock",
        "bedrock-runtime" => "Bedrock Runtime",
    }
});

// ── Terraform aws_* prefix → friendly service name ──

pub static TF_PREFIX_TO_SERVICE: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "s3" => "S3",
        "dynamodb" => "DynamoDB",
        "lambda" => "Lambda",
        "sqs" => "SQS",
        "sns" => "SNS",
        "ses" => "SES",
        "iam" => "IAM",
        "ec2" => "EC2",
        "ecs" => "ECS",
        "ecr" => "ECR",
        "eks" => "EKS",
        "rds" => "RDS",
        "elasticache" => "ElastiCache",
        "kinesis" => "Kinesis",
        "firehose" => "Firehose",
        "sfn" => "Step Functions",
        "apigateway" => "API Gateway",
        "apigatewayv2" => "API Gateway v2",
        "cognito" => "Cognito",
        "secretsmanager" => "Secrets Manager",
        "ssm" => "Systems Manager",
        "kms" => "KMS",
        "route53" => "Route 53",
        "cloudfront" => "CloudFront",
        "cloudwatch" => "CloudWatch",
        "cloudformation" => "CloudFormation",
        "eventbridge" => "EventBridge",
        "athena" => "Athena",
        "glue" => "Glue",
        "redshift" => "Redshift",
        "opensearch" => "OpenSearch",
        "elasticsearch" => "OpenSearch",
        "autoscaling" => "Auto Scaling",
        "lb" => "ELB",
        "alb" => "ALB",
        "elb" => "ELB",
        "codebuild" => "CodeBuild",
        "codepipeline" => "CodePipeline",
        "codecommit" => "CodeCommit",
        "codedeploy" => "CodeDeploy",
        "sagemaker" => "SageMaker",
        "bedrock" => "Bedrock",
        "vpc" => "VPC",
        "subnet" => "VPC",
        "security" => "VPC",
        "nat" => "VPC",
        "internet" => "VPC",
        "db" => "RDS",
        "waf" => "WAF",
        "acm" => "ACM",
    }
});

// ── boto3 service id → friendly service name ──

pub static BOTO3_TO_SERVICE: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "s3" => "S3",
        "dynamodb" => "DynamoDB",
        "lambda" => "Lambda",
        "sqs" => "SQS",
        "sns" => "SNS",
        "ses" => "SES",
        "iam" => "IAM",
        "sts" => "STS",
        "cloudwatch" => "CloudWatch",
        "logs" => "CloudWatch Logs",
        "cloudformation" => "CloudFormation",
        "ec2" => "EC2",
        "ecs" => "ECS",
        "ecr" => "ECR",
        "eks" => "EKS",
        "rds" => "RDS",
        "elasticache" => "ElastiCache",
        "kinesis" => "Kinesis",
        "firehose" => "Firehose",
        "stepfunctions" => "Step Functions",
        "apigateway" => "API Gateway",
        "apigatewayv2" => "API Gateway v2",
        "cognito-idp" => "Cognito User Pools",
        "cognito-identity" => "Cognito Identity",
        "secretsmanager" => "Secrets Manager",
        "ssm" => "Systems Manager",
        "kms" => "KMS",
        "route53" => "Route 53",
        "cloudfront" => "CloudFront",
        "events" => "EventBridge",
        "athena" => "Athena",
        "glue" => "Glue",
        "redshift" => "Redshift",
        "sagemaker" => "SageMaker",
        "bedrock-runtime" => "Bedrock Runtime",
        "bedrock" => "Bedrock",
        "textract" => "Textract",
        "rekognition" => "Rekognition",
        "comprehend" => "Comprehend",
        "translate" => "Translate",
        "polly" => "Polly",
    }
});

// ── Azure Terraform azurerm_* prefix → friendly service name ──

pub static TF_AZURERM_TO_SERVICE: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "storage" => "Storage",
        "kubernetes" => "AKS",
        "container" => "Container Instances",
        "cosmosdb" => "Cosmos DB",
        "sql" => "SQL Database",
        "mysql" => "MySQL",
        "postgresql" => "PostgreSQL",
        "redis" => "Redis Cache",
        "servicebus" => "Service Bus",
        "eventhub" => "Event Hubs",
        "function" => "Functions",
        "app_service" => "App Service",
        "linux_web" => "App Service",
        "windows_web" => "App Service",
        "logic_app" => "Logic Apps",
        "key_vault" => "Key Vault",
        "monitor" => "Monitor",
        "log_analytics" => "Log Analytics",
        "application_insights" => "Application Insights",
        "virtual_machine" => "Virtual Machines",
        "virtual_network" => "Virtual Network",
        "subnet" => "Virtual Network",
        "network_security" => "NSG",
        "lb" => "Load Balancer",
        "application_gateway" => "Application Gateway",
        "frontdoor" => "Front Door",
        "cdn" => "CDN",
        "dns" => "DNS",
        "private_dns" => "Private DNS",
        "cognitive" => "Cognitive Services",
        "search" => "Cognitive Search",
        "synapse" => "Synapse Analytics",
        "data_factory" => "Data Factory",
        "databricks" => "Databricks",
        "batch" => "Batch",
        "notification_hub" => "Notification Hubs",
        "signalr" => "SignalR",
        "api_management" => "API Management",
        "firewall" => "Firewall",
        "bastion" => "Bastion",
    }
});

// ── ARM namespace → friendly service name ──

pub static ARM_NAMESPACE_TO_SERVICE: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "Microsoft.Compute" => "Virtual Machines",
        "Microsoft.Storage" => "Storage",
        "Microsoft.Network" => "Virtual Network",
        "Microsoft.Web" => "App Service",
        "Microsoft.Sql" => "SQL Database",
        "Microsoft.DocumentDB" => "Cosmos DB",
        "Microsoft.Cache" => "Redis Cache",
        "Microsoft.ServiceBus" => "Service Bus",
        "Microsoft.EventHub" => "Event Hubs",
        "Microsoft.KeyVault" => "Key Vault",
        "Microsoft.ContainerService" => "AKS",
        "Microsoft.ContainerRegistry" => "Container Registry",
        "Microsoft.ContainerInstance" => "Container Instances",
        "Microsoft.CognitiveServices" => "Cognitive Services",
        "Microsoft.Search" => "Cognitive Search",
        "Microsoft.Insights" => "Application Insights",
        "Microsoft.OperationalInsights" => "Log Analytics",
        "Microsoft.Logic" => "Logic Apps",
        "Microsoft.ApiManagement" => "API Management",
        "Microsoft.Cdn" => "CDN",
        "Microsoft.SignalRService" => "SignalR",
        "Microsoft.NotificationHubs" => "Notification Hubs",
        "Microsoft.Synapse" => "Synapse Analytics",
        "Microsoft.DataFactory" => "Data Factory",
        "Microsoft.Databricks" => "Databricks",
    }
});

// ── GCP Terraform google_* prefix → friendly service name ──

pub static TF_GOOGLE_TO_SERVICE: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "storage" => "Cloud Storage",
        "bigquery" => "BigQuery",
        "compute" => "Compute Engine",
        "container" => "GKE",
        "cloud_run" => "Cloud Run",
        "cloudfunctions" => "Cloud Functions",
        "pubsub" => "Pub/Sub",
        "sql" => "Cloud SQL",
        "spanner" => "Spanner",
        "firestore" => "Firestore",
        "bigtable" => "Bigtable",
        "redis" => "Memorystore",
        "kms" => "Cloud KMS",
        "secret_manager" => "Secret Manager",
        "logging" => "Cloud Logging",
        "monitoring" => "Cloud Monitoring",
        "dataflow" => "Dataflow",
        "dataproc" => "Dataproc",
        "composer" => "Cloud Composer",
        "cloudbuild" => "Cloud Build",
        "artifact_registry" => "Artifact Registry",
        "dns" => "Cloud DNS",
        "vpc" => "VPC",
        "network" => "VPC",
        "service_account" => "IAM",
        "project_iam" => "IAM",
        "endpoints" => "Cloud Endpoints",
        "app_engine" => "App Engine",
        "memcache" => "Memorystore",
        "filestore" => "Filestore",
    }
});

// ── Framework mappings ──

pub static JS_FRAMEWORKS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "react" => "React",
        "react-dom" => "React",
        "next" => "Next.js",
        "vue" => "Vue",
        "nuxt" => "Nuxt",
        "@angular/core" => "Angular",
        "svelte" => "Svelte",
        "@sveltejs/kit" => "SvelteKit",
        "express" => "Express",
        "@nestjs/core" => "NestJS",
        "hono" => "Hono",
        "@remix-run/node" => "Remix",
        "@remix-run/react" => "Remix",
        "astro" => "Astro",
        "gatsby" => "Gatsby",
        "solid-js" => "Solid",
        "preact" => "Preact",
        "fastify" => "Fastify",
        "koa" => "Koa",
        "socket.io" => "Socket.IO",
        "electron" => "Electron",
        "@tanstack/react-query" => "TanStack Query",
        "react-router" => "React Router",
        "react-router-dom" => "React Router",
        "redux" => "Redux",
        "@reduxjs/toolkit" => "Redux Toolkit",
        "zustand" => "Zustand",
        "framer-motion" => "Framer Motion",
        "three" => "Three.js",
        "@trpc/server" => "tRPC",
        "@trpc/client" => "tRPC",
        "tailwindcss" => "Tailwind CSS",
        "@emotion/react" => "Emotion",
        "styled-components" => "styled-components",
        "@mui/material" => "Material UI",
        "@chakra-ui/react" => "Chakra UI",
        "ant-design" => "Ant Design",
        "antd" => "Ant Design",
    }
});

pub static PY_FRAMEWORKS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "django" => "Django",
        "flask" => "Flask",
        "fastapi" => "FastAPI",
        "starlette" => "Starlette",
        "celery" => "Celery",
        "tornado" => "Tornado",
        "sanic" => "Sanic",
        "aiohttp" => "aiohttp",
        "bottle" => "Bottle",
        "pyramid" => "Pyramid",
        "streamlit" => "Streamlit",
        "gradio" => "Gradio",
    }
});

pub static RUBY_FRAMEWORKS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "rails" => "Rails",
        "sinatra" => "Sinatra",
        "hanami" => "Hanami",
    }
});

pub static PHP_FRAMEWORKS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "laravel/framework" => "Laravel",
        "symfony/framework-bundle" => "Symfony",
        "slim/slim" => "Slim",
        "cakephp/cakephp" => "CakePHP",
    }
});

pub static JAVA_FRAMEWORKS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "org.springframework.boot:spring-boot-starter" => "Spring Boot",
        "org.springframework.boot:spring-boot-starter-web" => "Spring Boot",
        "org.springframework:spring-core" => "Spring",
        "io.quarkus:quarkus-core" => "Quarkus",
        "io.micronaut:micronaut-core" => "Micronaut",
        "io.vertx:vertx-core" => "Vert.x",
    }
});

pub static GO_FRAMEWORKS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "github.com/gin-gonic/gin" => "Gin",
        "github.com/labstack/echo" => "Echo",
        "github.com/gofiber/fiber" => "Fiber",
        "github.com/go-chi/chi" => "Chi",
        "github.com/gorilla/mux" => "Gorilla Mux",
        "github.com/beego/beego" => "Beego",
    }
});

pub static RUST_FRAMEWORKS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "actix-web" => "Actix Web",
        "axum" => "Axum",
        "rocket" => "Rocket",
        "warp" => "Warp",
        "tide" => "Tide",
    }
});

// ── Database mappings ──

pub static JS_DB_PACKAGES: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "pg" => "PostgreSQL",
        "pg-pool" => "PostgreSQL",
        "mysql2" => "MySQL",
        "mysql" => "MySQL",
        "mongoose" => "MongoDB",
        "mongodb" => "MongoDB",
        "redis" => "Redis",
        "ioredis" => "Redis",
        "prisma" => "Prisma",
        "@prisma/client" => "Prisma",
        "drizzle-orm" => "Drizzle",
        "typeorm" => "TypeORM",
        "sequelize" => "Sequelize",
        "knex" => "Knex",
        "better-sqlite3" => "SQLite",
        "sqlite3" => "SQLite",
        "mssql" => "SQL Server",
        "cassandra-driver" => "Cassandra",
        "neo4j" => "Neo4j",
        "neo4j-driver" => "Neo4j",
        "dynamoose" => "DynamoDB",
        "@elastic/elasticsearch" => "Elasticsearch",
        "firebase-admin" => "Firebase",
    }
});

pub static PY_DB_PACKAGES: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "psycopg2" => "PostgreSQL",
        "psycopg2-binary" => "PostgreSQL",
        "asyncpg" => "PostgreSQL",
        "pymongo" => "MongoDB",
        "motor" => "MongoDB",
        "sqlalchemy" => "SQLAlchemy",
        "redis" => "Redis",
        "django-redis" => "Redis",
        "databases" => "Databases",
        "peewee" => "Peewee",
        "tortoise" => "Tortoise ORM",
        "tortoise-orm" => "Tortoise ORM",
        "pymysql" => "MySQL",
        "mysql-connector-python" => "MySQL",
        "cassandra" => "Cassandra",
        "elasticsearch" => "Elasticsearch",
    }
});

pub static RUBY_DB_GEMS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "pg" => "PostgreSQL",
        "mysql2" => "MySQL",
        "mongoid" => "MongoDB",
        "redis" => "Redis",
        "sequel" => "Sequel",
        "activerecord" => "ActiveRecord",
    }
});

pub static PHP_DB_PACKAGES: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "doctrine/orm" => "Doctrine",
        "doctrine/dbal" => "Doctrine",
        "predis/predis" => "Redis",
        "mongodb/mongodb" => "MongoDB",
        "illuminate/database" => "Eloquent",
    }
});

pub static JAVA_DB_ARTIFACTS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "postgresql" => "PostgreSQL",
        "mysql-connector" => "MySQL",
        "hibernate-core" => "Hibernate",
        "spring-data-jpa" => "Spring Data JPA",
        "spring-data-mongodb" => "MongoDB",
        "jedis" => "Redis",
        "mongo-java-driver" => "MongoDB",
        "elasticsearch-rest-high-level-client" => "Elasticsearch",
    }
});

pub static GO_DB_PACKAGES: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "github.com/jackc/pgx" => "PostgreSQL",
        "github.com/lib/pq" => "PostgreSQL",
        "github.com/go-redis/redis" => "Redis",
        "github.com/redis/go-redis" => "Redis",
        "gorm.io/gorm" => "GORM",
        "go.mongodb.org/mongo-driver" => "MongoDB",
        "github.com/go-sql-driver/mysql" => "MySQL",
        "github.com/mattn/go-sqlite3" => "SQLite",
    }
});

pub static RUST_DB_CRATES: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "diesel" => "Diesel",
        "sqlx" => "SQLx",
        "tokio-postgres" => "PostgreSQL",
        "sea-orm" => "SeaORM",
        "mongodb" => "MongoDB",
        "redis" => "Redis",
    }
});

// ── Testing/Quality tool mappings ──

pub struct TestingTool {
    pub name: &'static str,
    pub category: &'static str,
}

pub static JS_TESTING_PACKAGES: LazyLock<BTreeMap<&str, TestingTool>> = LazyLock::new(|| {
    let mut m = BTreeMap::new();
    m.insert(
        "jest",
        TestingTool {
            name: "Jest",
            category: "testing",
        },
    );
    m.insert(
        "vitest",
        TestingTool {
            name: "Vitest",
            category: "testing",
        },
    );
    m.insert(
        "mocha",
        TestingTool {
            name: "Mocha",
            category: "testing",
        },
    );
    m.insert(
        "ava",
        TestingTool {
            name: "AVA",
            category: "testing",
        },
    );
    m.insert(
        "jasmine",
        TestingTool {
            name: "Jasmine",
            category: "testing",
        },
    );
    m.insert(
        "cypress",
        TestingTool {
            name: "Cypress",
            category: "e2e",
        },
    );
    m.insert(
        "playwright",
        TestingTool {
            name: "Playwright",
            category: "e2e",
        },
    );
    m.insert(
        "@playwright/test",
        TestingTool {
            name: "Playwright",
            category: "e2e",
        },
    );
    m.insert(
        "puppeteer",
        TestingTool {
            name: "Puppeteer",
            category: "e2e",
        },
    );
    m.insert(
        "@storybook/react",
        TestingTool {
            name: "Storybook",
            category: "testing",
        },
    );
    m.insert(
        "@storybook/vue3",
        TestingTool {
            name: "Storybook",
            category: "testing",
        },
    );
    m.insert(
        "@storybook/svelte",
        TestingTool {
            name: "Storybook",
            category: "testing",
        },
    );
    m.insert(
        "@testing-library/react",
        TestingTool {
            name: "Testing Library",
            category: "testing",
        },
    );
    m.insert(
        "@testing-library/jest-dom",
        TestingTool {
            name: "Testing Library",
            category: "testing",
        },
    );
    m.insert(
        "eslint",
        TestingTool {
            name: "ESLint",
            category: "linting",
        },
    );
    m.insert(
        "@biomejs/biome",
        TestingTool {
            name: "Biome",
            category: "linting",
        },
    );
    m.insert(
        "prettier",
        TestingTool {
            name: "Prettier",
            category: "formatting",
        },
    );
    m.insert(
        "husky",
        TestingTool {
            name: "Husky",
            category: "linting",
        },
    );
    m.insert(
        "lint-staged",
        TestingTool {
            name: "lint-staged",
            category: "linting",
        },
    );
    m.insert(
        "commitlint",
        TestingTool {
            name: "commitlint",
            category: "linting",
        },
    );
    m.insert(
        "@commitlint/cli",
        TestingTool {
            name: "commitlint",
            category: "linting",
        },
    );
    m.insert(
        "nyc",
        TestingTool {
            name: "NYC",
            category: "coverage",
        },
    );
    m.insert(
        "c8",
        TestingTool {
            name: "c8",
            category: "coverage",
        },
    );
    m.insert(
        "@vitest/coverage-v8",
        TestingTool {
            name: "Vitest Coverage",
            category: "coverage",
        },
    );
    m
});

pub static PY_TESTING_PACKAGES: LazyLock<BTreeMap<&str, TestingTool>> = LazyLock::new(|| {
    let mut m = BTreeMap::new();
    m.insert(
        "pytest",
        TestingTool {
            name: "pytest",
            category: "testing",
        },
    );
    m.insert(
        "pytest-cov",
        TestingTool {
            name: "pytest-cov",
            category: "coverage",
        },
    );
    m.insert(
        "tox",
        TestingTool {
            name: "tox",
            category: "testing",
        },
    );
    m.insert(
        "ruff",
        TestingTool {
            name: "Ruff",
            category: "linting",
        },
    );
    m.insert(
        "black",
        TestingTool {
            name: "Black",
            category: "formatting",
        },
    );
    m.insert(
        "mypy",
        TestingTool {
            name: "mypy",
            category: "linting",
        },
    );
    m.insert(
        "flake8",
        TestingTool {
            name: "flake8",
            category: "linting",
        },
    );
    m.insert(
        "pylint",
        TestingTool {
            name: "pylint",
            category: "linting",
        },
    );
    m.insert(
        "bandit",
        TestingTool {
            name: "Bandit",
            category: "linting",
        },
    );
    m.insert(
        "isort",
        TestingTool {
            name: "isort",
            category: "formatting",
        },
    );
    m.insert(
        "coverage",
        TestingTool {
            name: "Coverage.py",
            category: "coverage",
        },
    );
    m
});

pub static RUBY_TESTING_GEMS: LazyLock<BTreeMap<&str, TestingTool>> = LazyLock::new(|| {
    let mut m = BTreeMap::new();
    m.insert(
        "rspec",
        TestingTool {
            name: "RSpec",
            category: "testing",
        },
    );
    m.insert(
        "rspec-rails",
        TestingTool {
            name: "RSpec",
            category: "testing",
        },
    );
    m.insert(
        "rubocop",
        TestingTool {
            name: "RuboCop",
            category: "linting",
        },
    );
    m.insert(
        "simplecov",
        TestingTool {
            name: "SimpleCov",
            category: "coverage",
        },
    );
    m.insert(
        "cucumber",
        TestingTool {
            name: "Cucumber",
            category: "e2e",
        },
    );
    m.insert(
        "minitest",
        TestingTool {
            name: "Minitest",
            category: "testing",
        },
    );
    m
});

pub static JAVA_TESTING_ARTIFACTS: LazyLock<BTreeMap<&str, TestingTool>> = LazyLock::new(|| {
    let mut m = BTreeMap::new();
    m.insert(
        "junit",
        TestingTool {
            name: "JUnit",
            category: "testing",
        },
    );
    m.insert(
        "junit-jupiter",
        TestingTool {
            name: "JUnit 5",
            category: "testing",
        },
    );
    m.insert(
        "mockito",
        TestingTool {
            name: "Mockito",
            category: "testing",
        },
    );
    m.insert(
        "jacoco",
        TestingTool {
            name: "JaCoCo",
            category: "coverage",
        },
    );
    m.insert(
        "spotbugs",
        TestingTool {
            name: "SpotBugs",
            category: "linting",
        },
    );
    m.insert(
        "checkstyle",
        TestingTool {
            name: "Checkstyle",
            category: "linting",
        },
    );
    m
});

pub static GO_TESTING_PACKAGES: LazyLock<BTreeMap<&str, TestingTool>> = LazyLock::new(|| {
    let mut m = BTreeMap::new();
    m.insert(
        "github.com/stretchr/testify",
        TestingTool {
            name: "Testify",
            category: "testing",
        },
    );
    m.insert(
        "github.com/onsi/ginkgo",
        TestingTool {
            name: "Ginkgo",
            category: "testing",
        },
    );
    m.insert(
        "github.com/onsi/gomega",
        TestingTool {
            name: "Gomega",
            category: "testing",
        },
    );
    m.insert(
        "github.com/golangci/golangci-lint",
        TestingTool {
            name: "golangci-lint",
            category: "linting",
        },
    );
    m
});

// ── Language extension mapping ──

pub static LANG_EXTENSIONS: LazyLock<BTreeMap<&str, &str>> = LazyLock::new(|| {
    map! {
        "rs" => "Rust",
        "ts" => "TypeScript",
        "tsx" => "TypeScript",
        "js" => "JavaScript",
        "jsx" => "JavaScript",
        "mjs" => "JavaScript",
        "cjs" => "JavaScript",
        "py" => "Python",
        "go" => "Go",
        "java" => "Java",
        "kt" => "Kotlin",
        "kts" => "Kotlin",
        "scala" => "Scala",
        "rb" => "Ruby",
        "php" => "PHP",
        "cs" => "C#",
        "fs" => "F#",
        "c" => "C",
        "h" => "C",
        "cpp" => "C++",
        "cc" => "C++",
        "cxx" => "C++",
        "hpp" => "C++",
        "swift" => "Swift",
        "m" => "Objective-C",
        "mm" => "Objective-C",
        "dart" => "Dart",
        "ex" => "Elixir",
        "exs" => "Elixir",
        "erl" => "Erlang",
        "hs" => "Haskell",
        "lua" => "Lua",
        "r" => "R",
        "R" => "R",
        "pl" => "Perl",
        "pm" => "Perl",
        "sh" => "Shell",
        "bash" => "Shell",
        "zsh" => "Shell",
        "ps1" => "PowerShell",
        "vue" => "Vue",
        "svelte" => "Svelte",
        "tf" => "Terraform",
        "hcl" => "HCL",
        "sql" => "SQL",
        "html" => "HTML",
        "htm" => "HTML",
        "css" => "CSS",
        "scss" => "SCSS",
        "sass" => "Sass",
        "less" => "Less",
        "yaml" => "YAML",
        "yml" => "YAML",
        "json" => "JSON",
        "toml" => "TOML",
        "xml" => "XML",
        "md" => "Markdown",
        "mdx" => "MDX",
        "proto" => "Protocol Buffers",
        "graphql" => "GraphQL",
        "gql" => "GraphQL",
        "zig" => "Zig",
        "nim" => "Nim",
        "v" => "V",
        "clj" => "Clojure",
        "cljs" => "ClojureScript",
    }
});

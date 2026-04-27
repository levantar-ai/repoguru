import type { TreeEntry } from '../../types';
import type {
  DetectedAWSService,
  DetectedPythonPackage,
  DetectedAzureService,
  DetectedGCPService,
  DetectedPackage,
  DetectedFramework,
  DetectedDatabase,
  DetectedCicdTool,
  DetectedTestingTool,
} from '../../types/techDetect';

// ── AWS client-* suffix → friendly service name ──

const CLIENT_TO_SERVICE: Record<string, string> = {
  s3: 'S3',
  dynamodb: 'DynamoDB',
  lambda: 'Lambda',
  sqs: 'SQS',
  sns: 'SNS',
  ses: 'SES',
  sesv2: 'SES v2',
  iam: 'IAM',
  sts: 'STS',
  cloudwatch: 'CloudWatch',
  'cloudwatch-logs': 'CloudWatch Logs',
  cloudformation: 'CloudFormation',
  ec2: 'EC2',
  ecs: 'ECS',
  ecr: 'ECR',
  eks: 'EKS',
  rds: 'RDS',
  elasticache: 'ElastiCache',
  kinesis: 'Kinesis',
  firehose: 'Firehose',
  stepfunctions: 'Step Functions',
  sfn: 'Step Functions',
  apigateway: 'API Gateway',
  apigatewayv2: 'API Gateway v2',
  'cognito-identity': 'Cognito Identity',
  'cognito-identity-provider': 'Cognito User Pools',
  'secrets-manager': 'Secrets Manager',
  ssm: 'Systems Manager',
  kms: 'KMS',
  'route-53': 'Route 53',
  cloudfront: 'CloudFront',
  eventbridge: 'EventBridge',
  athena: 'Athena',
  glue: 'Glue',
  redshift: 'Redshift',
  'elasticsearch-service': 'OpenSearch',
  opensearch: 'OpenSearch',
  'auto-scaling': 'Auto Scaling',
  elb: 'ELB',
  'elastic-load-balancing-v2': 'ELB v2',
  codebuild: 'CodeBuild',
  codepipeline: 'CodePipeline',
  codecommit: 'CodeCommit',
  codedeploy: 'CodeDeploy',
  textract: 'Textract',
  rekognition: 'Rekognition',
  comprehend: 'Comprehend',
  translate: 'Translate',
  polly: 'Polly',
  sagemaker: 'SageMaker',
  bedrock: 'Bedrock',
  'bedrock-runtime': 'Bedrock Runtime',
};

// ── Terraform aws_* prefix → friendly service name ──

const TF_PREFIX_TO_SERVICE: Record<string, string> = {
  s3: 'S3',
  dynamodb: 'DynamoDB',
  lambda: 'Lambda',
  sqs: 'SQS',
  sns: 'SNS',
  ses: 'SES',
  iam: 'IAM',
  ec2: 'EC2',
  ecs: 'ECS',
  ecr: 'ECR',
  eks: 'EKS',
  rds: 'RDS',
  elasticache: 'ElastiCache',
  kinesis: 'Kinesis',
  firehose: 'Firehose',
  sfn: 'Step Functions',
  apigateway: 'API Gateway',
  apigatewayv2: 'API Gateway v2',
  cognito: 'Cognito',
  secretsmanager: 'Secrets Manager',
  ssm: 'Systems Manager',
  kms: 'KMS',
  route53: 'Route 53',
  cloudfront: 'CloudFront',
  cloudwatch: 'CloudWatch',
  cloudformation: 'CloudFormation',
  eventbridge: 'EventBridge',
  athena: 'Athena',
  glue: 'Glue',
  redshift: 'Redshift',
  opensearch: 'OpenSearch',
  elasticsearch: 'OpenSearch',
  autoscaling: 'Auto Scaling',
  lb: 'ELB',
  alb: 'ALB',
  elb: 'ELB',
  codebuild: 'CodeBuild',
  codepipeline: 'CodePipeline',
  codecommit: 'CodeCommit',
  codedeploy: 'CodeDeploy',
  sagemaker: 'SageMaker',
  bedrock: 'Bedrock',
  vpc: 'VPC',
  subnet: 'VPC',
  security: 'VPC',
  nat: 'VPC',
  internet: 'VPC',
  db: 'RDS',
  waf: 'WAF',
  acm: 'ACM',
};

// ── boto3 service id → friendly service name ──

const BOTO3_TO_SERVICE: Record<string, string> = {
  s3: 'S3',
  dynamodb: 'DynamoDB',
  lambda: 'Lambda',
  sqs: 'SQS',
  sns: 'SNS',
  ses: 'SES',
  iam: 'IAM',
  sts: 'STS',
  cloudwatch: 'CloudWatch',
  logs: 'CloudWatch Logs',
  cloudformation: 'CloudFormation',
  ec2: 'EC2',
  ecs: 'ECS',
  ecr: 'ECR',
  eks: 'EKS',
  rds: 'RDS',
  elasticache: 'ElastiCache',
  kinesis: 'Kinesis',
  firehose: 'Firehose',
  stepfunctions: 'Step Functions',
  apigateway: 'API Gateway',
  apigatewayv2: 'API Gateway v2',
  'cognito-idp': 'Cognito User Pools',
  'cognito-identity': 'Cognito Identity',
  secretsmanager: 'Secrets Manager',
  ssm: 'Systems Manager',
  kms: 'KMS',
  route53: 'Route 53',
  cloudfront: 'CloudFront',
  events: 'EventBridge',
  athena: 'Athena',
  glue: 'Glue',
  redshift: 'Redshift',
  sagemaker: 'SageMaker',
  'bedrock-runtime': 'Bedrock Runtime',
  bedrock: 'Bedrock',
  textract: 'Textract',
  rekognition: 'Rekognition',
  comprehend: 'Comprehend',
  translate: 'Translate',
  polly: 'Polly',
};

// ── Azure Terraform azurerm_* prefix → friendly service name ──

const TF_AZURERM_TO_SERVICE: Record<string, string> = {
  storage: 'Storage',
  kubernetes: 'AKS',
  container: 'Container Instances',
  cosmosdb: 'Cosmos DB',
  sql: 'SQL Database',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
  redis: 'Redis Cache',
  servicebus: 'Service Bus',
  eventhub: 'Event Hubs',
  function: 'Functions',
  app_service: 'App Service',
  linux_web: 'App Service',
  windows_web: 'App Service',
  logic_app: 'Logic Apps',
  key_vault: 'Key Vault',
  monitor: 'Monitor',
  log_analytics: 'Log Analytics',
  application_insights: 'Application Insights',
  virtual_machine: 'Virtual Machines',
  virtual_network: 'Virtual Network',
  subnet: 'Virtual Network',
  network_security: 'NSG',
  lb: 'Load Balancer',
  application_gateway: 'Application Gateway',
  frontdoor: 'Front Door',
  cdn: 'CDN',
  dns: 'DNS',
  private_dns: 'Private DNS',
  cognitive: 'Cognitive Services',
  search: 'Cognitive Search',
  synapse: 'Synapse Analytics',
  data_factory: 'Data Factory',
  databricks: 'Databricks',
  batch: 'Batch',
  notification_hub: 'Notification Hubs',
  signalr: 'SignalR',
  api_management: 'API Management',
  firewall: 'Firewall',
  bastion: 'Bastion',
};

// ── ARM namespace → friendly service name ──

const ARM_NAMESPACE_TO_SERVICE: Record<string, string> = {
  'Microsoft.Compute': 'Virtual Machines',
  'Microsoft.Storage': 'Storage',
  'Microsoft.Network': 'Virtual Network',
  'Microsoft.Web': 'App Service',
  'Microsoft.Sql': 'SQL Database',
  'Microsoft.DocumentDB': 'Cosmos DB',
  'Microsoft.Cache': 'Redis Cache',
  'Microsoft.ServiceBus': 'Service Bus',
  'Microsoft.EventHub': 'Event Hubs',
  'Microsoft.KeyVault': 'Key Vault',
  'Microsoft.ContainerService': 'AKS',
  'Microsoft.ContainerRegistry': 'Container Registry',
  'Microsoft.ContainerInstance': 'Container Instances',
  'Microsoft.CognitiveServices': 'Cognitive Services',
  'Microsoft.Search': 'Cognitive Search',
  'Microsoft.Insights': 'Application Insights',
  'Microsoft.OperationalInsights': 'Log Analytics',
  'Microsoft.Logic': 'Logic Apps',
  'Microsoft.ApiManagement': 'API Management',
  'Microsoft.Cdn': 'CDN',
  'Microsoft.SignalRService': 'SignalR',
  'Microsoft.NotificationHubs': 'Notification Hubs',
  'Microsoft.Synapse': 'Synapse Analytics',
  'Microsoft.DataFactory': 'Data Factory',
  'Microsoft.Databricks': 'Databricks',
};

// ── GCP Terraform google_* prefix → friendly service name ──

const TF_GOOGLE_TO_SERVICE: Record<string, string> = {
  storage: 'Cloud Storage',
  bigquery: 'BigQuery',
  compute: 'Compute Engine',
  container: 'GKE',
  cloud_run: 'Cloud Run',
  cloudfunctions: 'Cloud Functions',
  pubsub: 'Pub/Sub',
  sql: 'Cloud SQL',
  spanner: 'Spanner',
  firestore: 'Firestore',
  bigtable: 'Bigtable',
  redis: 'Memorystore',
  kms: 'Cloud KMS',
  secret_manager: 'Secret Manager',
  logging: 'Cloud Logging',
  monitoring: 'Cloud Monitoring',
  dataflow: 'Dataflow',
  dataproc: 'Dataproc',
  composer: 'Cloud Composer',
  cloudbuild: 'Cloud Build',
  artifact_registry: 'Artifact Registry',
  dns: 'Cloud DNS',
  vpc: 'VPC',
  network: 'VPC',
  service_account: 'IAM',
  project_iam: 'IAM',
  endpoints: 'Cloud Endpoints',
  app_engine: 'App Engine',
  memcache: 'Memorystore',
  filestore: 'Filestore',
};

interface FileInput {
  path: string;
  content: string;
}

// ── Helpers ──

function titleCase(s: string): string {
  return s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function dedupCloud<T extends { service: string; via: string; source: string }>(
  services: T[],
): T[] {
  const seen = new Map<string, T>();
  for (const s of services) {
    const key = `${s.service}|${s.via}|${s.source}`;
    if (!seen.has(key)) seen.set(key, s);
  }
  return [...seen.values()].sort((a, b) => a.service.localeCompare(b.service));
}

function dedupPackages<T extends { name: string; source: string }>(packages: T[]): T[] {
  const seen = new Map<string, T>();
  for (const p of packages) {
    const key = `${p.name}|${p.source}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── AWS Detection ──

function detectJsSdkV3(path: string, content: string): DetectedAWSService[] {
  if (!path.endsWith('package.json')) return [];
  const results: DetectedAWSService[] = [];

  try {
    const pkg = JSON.parse(content);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      const match = dep.match(/^@aws-sdk\/client-(.+)$/);
      if (match) {
        const suffix = match[1];
        const service = CLIENT_TO_SERVICE[suffix] || titleCase(suffix);
        results.push({ service, sdkPackage: dep, source: path, via: 'js-sdk-v3' });
      }
    }
  } catch {
    // Invalid JSON — skip
  }

  return results;
}

function detectJsSdkV2(path: string, content: string): DetectedAWSService[] {
  if (!path.endsWith('package.json')) return [];

  try {
    const pkg = JSON.parse(content);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps['aws-sdk']) {
      return [
        { service: 'AWS SDK v2 (general)', sdkPackage: 'aws-sdk', source: path, via: 'js-sdk-v2' },
      ];
    }
  } catch {
    // Invalid JSON — skip
  }

  return [];
}

function detectBoto3(files: FileInput[]): DetectedAWSService[] {
  const results: DetectedAWSService[] = [];
  const pattern = /(?:boto3|session)\s*\.\s*(?:client|resource)\s*\(\s*['"]([^'"]+)['"]/g;

  for (const file of files) {
    if (!file.path.endsWith('.py')) continue;
    let match;
    while ((match = pattern.exec(file.content)) !== null) {
      const svcId = match[1];
      const service = BOTO3_TO_SERVICE[svcId] || titleCase(svcId);
      results.push({ service, sdkPackage: `boto3:${svcId}`, source: file.path, via: 'boto3' });
    }
    pattern.lastIndex = 0;
  }

  return results;
}

function detectCloudFormation(files: FileInput[]): DetectedAWSService[] {
  const results: DetectedAWSService[] = [];
  const pattern = /AWS::(\w+)::\w+/g;

  for (const file of files) {
    if (!file.path.match(/\.(ya?ml|json|template)$/)) continue;
    let match;
    while ((match = pattern.exec(file.content)) !== null) {
      const service = match[1];
      results.push({ service, source: file.path, via: 'cloudformation' });
    }
    pattern.lastIndex = 0;
  }

  return results;
}

function detectTerraform(files: FileInput[]): DetectedAWSService[] {
  const results: DetectedAWSService[] = [];
  const pattern = /(?:resource|data)\s+"aws_([a-z0-9]+)(?:_[a-z0-9]+)*"/g;

  for (const file of files) {
    if (!file.path.endsWith('.tf')) continue;
    let match;
    while ((match = pattern.exec(file.content)) !== null) {
      const prefix = match[1];
      const service = TF_PREFIX_TO_SERVICE[prefix] || titleCase(prefix);
      results.push({ service, source: file.path, via: 'terraform' });
    }
    pattern.lastIndex = 0;
  }

  return results;
}

function detectCDK(path: string, content: string): DetectedAWSService[] {
  if (!path.endsWith('package.json')) return [];
  const results: DetectedAWSService[] = [];

  try {
    const pkg = JSON.parse(content);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      // aws-cdk-lib/aws-* or @aws-cdk/aws-*
      const match = dep.match(/^(?:@aws-cdk\/aws-|aws-cdk-lib\/aws-)(.+)$/);
      if (match) {
        const suffix = match[1];
        const service = CLIENT_TO_SERVICE[suffix] || titleCase(suffix);
        results.push({ service, sdkPackage: dep, source: path, via: 'cdk' });
      }
    }
  } catch {
    // Invalid JSON — skip
  }

  return results;
}

export function detectAWS(files: FileInput[]): DetectedAWSService[] {
  const results: DetectedAWSService[] = [];

  for (const file of files) {
    results.push(...detectJsSdkV3(file.path, file.content));
    results.push(...detectJsSdkV2(file.path, file.content));
    results.push(...detectCDK(file.path, file.content));
  }

  results.push(...detectBoto3(files));
  results.push(...detectCloudFormation(files));
  results.push(...detectTerraform(files));

  return dedupCloud(results);
}

// ── Python Detection ──

function parseRequirementsTxt(path: string, content: string): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('-') || line.startsWith('--')) continue;

    // Handle extras: package[extra]>=1.0
    const match = line.match(/^([a-zA-Z0-9_][a-zA-Z0-9._-]*)(?:\[[^\]]*\])?\s*(.*)$/);
    if (match) {
      const name = match[1].toLowerCase();
      const version = match[2]?.trim() || undefined;
      results.push({ name, version: version || undefined, source: path });
    }
  }

  return results;
}

function parsePep621Deps(path: string, content: string): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];
  const depsArrayMatch = /\[project\]\n[^[]*dependencies\s*=\s*\[([\s\S]*?)\]/.exec(content);
  if (!depsArrayMatch) return results;

  for (const line of depsArrayMatch[1].split('\n')) {
    const m = /["'](\w[\w.-]*)(?:\[[^\]]*\])?\s*([^"']*)["']/.exec(line);
    if (m) {
      results.push({ name: m[1].toLowerCase(), version: m[2].trim() || undefined, source: path });
    }
  }
  return results;
}

function parsePoetryDeps(path: string, content: string): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];
  const poetryMatch = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
  if (!poetryMatch) return results;

  for (const line of poetryMatch[1].split('\n')) {
    const m = /^(\w[\w.-]*)\s*=\s*(?:["']([^"'\n]*)["']|(\S+))/.exec(line);
    if (m && m[1] !== 'python') {
      const version = (m[2] ?? m[3])?.trim() || undefined;
      results.push({ name: m[1].toLowerCase(), version, source: path });
    }
  }
  return results;
}

function parseOptionalDepsLine(path: string, line: string): DetectedPythonPackage | null {
  const arrM = /["'](\w[\w.-]*)(?:\[[^\]]*\])?\s*([^"']*)["']/.exec(line);
  if (arrM) {
    return { name: arrM[1].toLowerCase(), version: arrM[2].trim() || undefined, source: path };
  }
  const kvM = /^(\w[\w.-]*)\s*=\s*(?:["']([^"'\n]*)["']|(\S+))/.exec(line);
  if (kvM && kvM[1] !== 'python') {
    const version = (kvM[2] ?? kvM[3])?.trim() || undefined;
    return { name: kvM[1].toLowerCase(), version, source: path };
  }
  return null;
}

function parseOptionalDeps(path: string, content: string): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];
  const optMatch = content.matchAll(
    /\[(?:project\.optional-dependencies|tool\.poetry\.(?:dev-)?dependencies)\]([\s\S]*?)(?:\n\[|$)/g,
  );
  for (const section of optMatch) {
    for (const line of section[1].split('\n')) {
      const pkg = parseOptionalDepsLine(path, line);
      if (pkg) results.push(pkg);
    }
  }
  return results;
}

function parsePyprojectToml(path: string, content: string): DetectedPythonPackage[] {
  return [
    ...parsePep621Deps(path, content),
    ...parsePoetryDeps(path, content),
    ...parseOptionalDeps(path, content),
  ];
}

function parsePipfile(path: string, content: string): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];

  const sections = content.matchAll(/\[(?:packages|dev-packages)\]([\s\S]*?)(?:\n\[|$)/g);
  for (const section of sections) {
    const lines = section[1].split('\n');
    for (const line of lines) {
      const m = /^(\w[\w.-]*)\s*=\s*(?:["']([^"'\n]*)["']|(\S+))/.exec(line);
      if (m) {
        const raw = (m[2] ?? m[3])?.trim();
        const version = raw === '*' ? undefined : raw || undefined;
        results.push({ name: m[1].toLowerCase(), version, source: path });
      }
    }
  }

  return results;
}

function parseSetupPy(path: string, content: string): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];

  // Best-effort: match install_requires=[...] list
  const match = content.match(/install_requires\s*=\s*\[([\s\S]*?)\]/);
  if (match) {
    const items = match[1].matchAll(/["'](\w[\w.-]*)(?:\[[^\]]*\])?\s*([^"']*)["']/g);
    for (const m of items) {
      results.push({ name: m[1].toLowerCase(), version: m[2].trim() || undefined, source: path });
    }
  }

  return results;
}

function parseSetupCfg(path: string, content: string): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];

  // Match [options] section's install_requires
  const optionsMatch = content.match(/\[options\]([\s\S]*?)(?:\n\[|$)/);
  if (optionsMatch) {
    const irMatch = /install_requires\s*=\s*([^\n]*(?:\n[ \t]+[^\n]*)*)/.exec(optionsMatch[1]);
    if (irMatch) {
      const lines = irMatch[1].split('\n');
      for (const line of lines) {
        const m = /^(\w[\w.-]*)(?:\[[^\]]*\])?\s*(.*)$/.exec(line.trim());
        if (m?.[1]) {
          results.push({
            name: m[1].toLowerCase(),
            version: m[2]?.trim() || undefined,
            source: path,
          });
        }
      }
    }
  }

  return results;
}

export function detectPython(files: FileInput[]): DetectedPythonPackage[] {
  const results: DetectedPythonPackage[] = [];

  for (const file of files) {
    const basename = file.path.split('/').pop() || '';

    if (basename === 'requirements.txt' || file.path.match(/requirements\/.*\.txt$/)) {
      results.push(...parseRequirementsTxt(file.path, file.content));
    } else if (basename === 'pyproject.toml') {
      results.push(...parsePyprojectToml(file.path, file.content));
    } else if (basename === 'Pipfile') {
      results.push(...parsePipfile(file.path, file.content));
    } else if (basename === 'setup.py') {
      results.push(...parseSetupPy(file.path, file.content));
    } else if (basename === 'setup.cfg') {
      results.push(...parseSetupCfg(file.path, file.content));
    }
  }

  return dedupPackages(results);
}

// ── Azure Detection ──

function detectAzureTerraform(file: FileInput): DetectedAzureService[] {
  if (!file.path.endsWith('.tf')) return [];
  const results: DetectedAzureService[] = [];
  const pattern = /(?:resource|data)\s+"azurerm_([a-z0-9]+)(?:_[a-z0-9]+)*"/g;
  let match;
  while ((match = pattern.exec(file.content)) !== null) {
    const prefix = match[1];
    const service = TF_AZURERM_TO_SERVICE[prefix] || titleCase(prefix);
    results.push({ service, source: file.path, via: 'terraform' });
  }
  pattern.lastIndex = 0;
  return results;
}

function detectAzureArmTemplates(file: FileInput): DetectedAzureService[] {
  if (!file.path.endsWith('.json')) return [];
  const results: DetectedAzureService[] = [];
  try {
    if (!file.content.includes('deploymentTemplate') && !file.content.includes('Microsoft.')) {
      return results;
    }
    const nsPattern = /"(Microsoft\.\w+)/g;
    let match;
    while ((match = nsPattern.exec(file.content)) !== null) {
      const ns = match[1];
      const service = ARM_NAMESPACE_TO_SERVICE[ns] || ns.replace('Microsoft.', '');
      results.push({ service, source: file.path, via: 'arm-template' });
    }
    nsPattern.lastIndex = 0;
  } catch {
    /* skip */
  }
  return results;
}

function detectAzureBicep(file: FileInput): DetectedAzureService[] {
  if (!file.path.endsWith('.bicep')) return [];
  const results: DetectedAzureService[] = [];
  const nsPattern = /'(Microsoft\.\w+)/g;
  let match;
  while ((match = nsPattern.exec(file.content)) !== null) {
    const ns = match[1];
    const service = ARM_NAMESPACE_TO_SERVICE[ns] || ns.replace('Microsoft.', '');
    results.push({ service, source: file.path, via: 'bicep' });
  }
  nsPattern.lastIndex = 0;
  return results;
}

function detectAzureNpmSdk(file: FileInput): DetectedAzureService[] {
  if (!file.path.endsWith('package.json')) return [];
  const results: DetectedAzureService[] = [];
  try {
    const pkg = JSON.parse(file.content);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      const match = dep.match(/^@azure\/(.+)$/);
      if (match) {
        const suffix = match[1];
        const service = titleCase(suffix);
        results.push({ service, sdkPackage: dep, source: file.path, via: 'npm-sdk' });
      }
    }
  } catch {
    /* skip */
  }
  return results;
}

function detectAzurePythonSdk(file: FileInput): DetectedAzureService[] {
  const isPythonManifest =
    file.path.endsWith('requirements.txt') ||
    file.path.endsWith('pyproject.toml') ||
    file.path.endsWith('Pipfile');
  if (!isPythonManifest) return [];

  const results: DetectedAzureService[] = [];
  const pattern = /azure[_-][\w-]+/gi;
  let match;
  while ((match = pattern.exec(file.content)) !== null) {
    const pkg = match[0].toLowerCase();
    const service = titleCase(pkg.replace(/^azure[_-]/, ''));
    results.push({ service, sdkPackage: pkg, source: file.path, via: 'python-sdk' });
  }
  pattern.lastIndex = 0;
  return results;
}

export function detectAzure(files: FileInput[]): DetectedAzureService[] {
  const results: DetectedAzureService[] = [];

  for (const file of files) {
    results.push(
      ...detectAzureTerraform(file),
      ...detectAzureArmTemplates(file),
      ...detectAzureBicep(file),
      ...detectAzureNpmSdk(file),
      ...detectAzurePythonSdk(file),
    );
  }

  return dedupCloud(results);
}

// ── GCP Detection ──

function detectGcpTerraform(file: FileInput): DetectedGCPService[] {
  if (!file.path.endsWith('.tf')) return [];
  const results: DetectedGCPService[] = [];
  const pattern = /(?:resource|data)\s+"google_([a-z0-9]+)(?:_[a-z0-9]+)*"/g;
  let match;
  while ((match = pattern.exec(file.content)) !== null) {
    const prefix = match[1];
    const service = TF_GOOGLE_TO_SERVICE[prefix] || titleCase(prefix);
    results.push({ service, source: file.path, via: 'terraform' });
  }
  pattern.lastIndex = 0;
  return results;
}

function detectGcpNpmSdk(file: FileInput): DetectedGCPService[] {
  if (!file.path.endsWith('package.json')) return [];
  const results: DetectedGCPService[] = [];
  try {
    const pkg = JSON.parse(file.content);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const dep of Object.keys(allDeps)) {
      const match = dep.match(/^@google-cloud\/(.+)$/);
      if (match) {
        const suffix = match[1];
        const service = TF_GOOGLE_TO_SERVICE[suffix] || titleCase(suffix);
        results.push({ service, sdkPackage: dep, source: file.path, via: 'npm-sdk' });
      }
    }
  } catch {
    /* skip */
  }
  return results;
}

function detectGcpPythonSdk(file: FileInput): DetectedGCPService[] {
  const isPythonManifest =
    file.path.endsWith('requirements.txt') ||
    file.path.endsWith('pyproject.toml') ||
    file.path.endsWith('Pipfile');
  if (!isPythonManifest) return [];

  const results: DetectedGCPService[] = [];
  const pattern = /google-cloud-[\w-]+/gi;
  let match;
  while ((match = pattern.exec(file.content)) !== null) {
    const pkg = match[0].toLowerCase();
    const service = titleCase(pkg.replace(/^google-cloud-/, ''));
    results.push({ service, sdkPackage: pkg, source: file.path, via: 'python-sdk' });
  }
  pattern.lastIndex = 0;
  return results;
}

export function detectGCP(files: FileInput[]): DetectedGCPService[] {
  const results: DetectedGCPService[] = [];

  for (const file of files) {
    results.push(
      ...detectGcpTerraform(file),
      ...detectGcpNpmSdk(file),
      ...detectGcpPythonSdk(file),
    );
  }

  return dedupCloud(results);
}

// ── Go Detection ──

export function detectGo(files: FileInput[]): DetectedPackage[] {
  const results: DetectedPackage[] = [];

  for (const file of files) {
    if (!file.path.endsWith('go.mod')) continue;

    // Match require blocks: require ( ... )
    const blockPattern = /require\s*\(([\s\S]*?)\)/g;
    let blockMatch;
    while ((blockMatch = blockPattern.exec(file.content)) !== null) {
      const block = blockMatch[1];
      const linePattern = /^\s*(\S+)\s+(\S+)/gm;
      let lineMatch;
      while ((lineMatch = linePattern.exec(block)) !== null) {
        if (!lineMatch[1].startsWith('//')) {
          results.push({ name: lineMatch[1], version: lineMatch[2], source: file.path });
        }
      }
    }
    blockPattern.lastIndex = 0;

    // Single-line requires: require github.com/foo v1.0.0
    const singlePattern = /^require\s+(\S+)\s+(\S+)/gm;
    let singleMatch;
    while ((singleMatch = singlePattern.exec(file.content)) !== null) {
      results.push({ name: singleMatch[1], version: singleMatch[2], source: file.path });
    }
    singlePattern.lastIndex = 0;
  }

  return dedupPackages(results);
}

// ── Java Detection ──

export function detectJava(files: FileInput[]): DetectedPackage[] {
  const results: DetectedPackage[] = [];

  for (const file of files) {
    const basename = file.path.split('/').pop() || '';

    // Maven pom.xml
    if (basename === 'pom.xml') {
      const depPattern =
        /<dependency>\s*<groupId>([^<]*)<\/groupId>\s*<artifactId>([^<]*)<\/artifactId>(?:\s*<version>([^<]*)<\/version>)?/gs;
      let match;
      while ((match = depPattern.exec(file.content)) !== null) {
        results.push({
          name: `${match[1]}:${match[2]}`,
          version: match[3] || undefined,
          source: file.path,
        });
      }
      depPattern.lastIndex = 0;
    }

    // Gradle build.gradle or build.gradle.kts
    if (basename === 'build.gradle' || basename === 'build.gradle.kts') {
      // implementation 'group:artifact:version' or implementation("group:artifact:version")
      const gradlePattern =
        /(?:implementation|api|compileOnly|runtimeOnly|testImplementation)\s*[("']([^):'"]+)(?::([^)'"]*))?[)"']/g;
      let match;
      while ((match = gradlePattern.exec(file.content)) !== null) {
        const parts = match[1].split(':');
        if (parts.length >= 2) {
          const name = `${parts[0]}:${parts[1]}`;
          const version = parts[2] || match[2] || undefined;
          results.push({ name, version, source: file.path });
        }
      }
      gradlePattern.lastIndex = 0;
    }
  }

  return dedupPackages(results);
}

// ── Node Detection ──

const CLOUD_PREFIXES = [
  '@aws-sdk/',
  'aws-sdk',
  '@aws-cdk/',
  'aws-cdk-lib',
  '@azure/',
  '@google-cloud/',
];

function isCloudSdkPackage(name: string): boolean {
  return CLOUD_PREFIXES.some((p) => name.startsWith(p));
}

function parseNodePackageJson(file: FileInput): DetectedPackage[] {
  const results: DetectedPackage[] = [];
  try {
    const pkg = JSON.parse(file.content);
    const sections = [pkg.dependencies, pkg.devDependencies];
    for (const deps of sections) {
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps)) {
        if (!isCloudSdkPackage(name)) {
          results.push({ name, version: version as string, source: file.path });
        }
      }
    }
  } catch {
    /* skip */
  }
  return results;
}

export function detectNode(files: FileInput[]): DetectedPackage[] {
  const results: DetectedPackage[] = [];

  for (const file of files) {
    if (!file.path.endsWith('package.json')) continue;
    results.push(...parseNodePackageJson(file));
  }

  return dedupPackages(results);
}

// ── PHP Detection ──

function parseComposerJson(file: FileInput): DetectedPackage[] {
  const results: DetectedPackage[] = [];
  try {
    const composer = JSON.parse(file.content);
    const sections = [composer.require, composer['require-dev']];
    for (const deps of sections) {
      if (!deps) continue;
      for (const [name, version] of Object.entries(deps)) {
        if (name !== 'php' && !name.startsWith('ext-')) {
          results.push({ name, version: version as string, source: file.path });
        }
      }
    }
  } catch {
    /* skip */
  }
  return results;
}

export function detectPHP(files: FileInput[]): DetectedPackage[] {
  const results: DetectedPackage[] = [];

  for (const file of files) {
    if (!file.path.endsWith('composer.json')) continue;
    results.push(...parseComposerJson(file));
  }

  return dedupPackages(results);
}

// ── Rust Detection ──

function parseCargoDependencyLine(line: string, source: string): DetectedPackage | null {
  const simpleMatch = /^([\w-]+)\s*=\s*"([^"]*)"/.exec(line);
  if (simpleMatch) {
    return { name: simpleMatch[1], version: simpleMatch[2], source };
  }
  const tableMatch = /^([\w-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]*)"/.exec(line);
  if (tableMatch) {
    return { name: tableMatch[1], version: tableMatch[2], source };
  }
  return null;
}

function parseCargoToml(file: FileInput): DetectedPackage[] {
  const results: DetectedPackage[] = [];
  const sectionPattern = /\[(?:dev-|build-)?dependencies\]([\s\S]*?)(?=\n\[|$)/g;
  let sectionMatch;
  while ((sectionMatch = sectionPattern.exec(file.content)) !== null) {
    for (const line of sectionMatch[1].split('\n')) {
      const pkg = parseCargoDependencyLine(line, file.path);
      if (pkg) results.push(pkg);
    }
  }
  sectionPattern.lastIndex = 0;
  return results;
}

export function detectRust(files: FileInput[]): DetectedPackage[] {
  const results: DetectedPackage[] = [];

  for (const file of files) {
    if (!file.path.endsWith('Cargo.toml')) continue;
    results.push(...parseCargoToml(file));
  }

  return dedupPackages(results);
}

// ── Ruby Detection ──

export function detectRuby(files: FileInput[]): DetectedPackage[] {
  const results: DetectedPackage[] = [];

  for (const file of files) {
    if (!file.path.endsWith('Gemfile')) continue;

    const gemPattern = /^\s*gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]*)['"]\s*)?/gm;
    let match;
    while ((match = gemPattern.exec(file.content)) !== null) {
      results.push({ name: match[1], version: match[2] || undefined, source: file.path });
    }
    gemPattern.lastIndex = 0;
  }

  return dedupPackages(results);
}

// ── Framework Detection ──

const JS_FRAMEWORKS: Record<string, string> = {
  react: 'React',
  'react-dom': 'React',
  next: 'Next.js',
  vue: 'Vue',
  nuxt: 'Nuxt',
  '@angular/core': 'Angular',
  svelte: 'Svelte',
  '@sveltejs/kit': 'SvelteKit',
  express: 'Express',
  '@nestjs/core': 'NestJS',
  hono: 'Hono',
  '@remix-run/node': 'Remix',
  '@remix-run/react': 'Remix',
  astro: 'Astro',
  gatsby: 'Gatsby',
  'solid-js': 'Solid',
  preact: 'Preact',
  fastify: 'Fastify',
  koa: 'Koa',
  'socket.io': 'Socket.IO',
  electron: 'Electron',
  '@tanstack/react-query': 'TanStack Query',
  'react-router': 'React Router',
  'react-router-dom': 'React Router',
  redux: 'Redux',
  '@reduxjs/toolkit': 'Redux Toolkit',
  zustand: 'Zustand',
  'framer-motion': 'Framer Motion',
  three: 'Three.js',
  '@trpc/server': 'tRPC',
  '@trpc/client': 'tRPC',
  tailwindcss: 'Tailwind CSS',
  '@emotion/react': 'Emotion',
  'styled-components': 'styled-components',
  '@mui/material': 'Material UI',
  '@chakra-ui/react': 'Chakra UI',
  'ant-design': 'Ant Design',
  antd: 'Ant Design',
};

const PY_FRAMEWORKS: Record<string, string> = {
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  starlette: 'Starlette',
  celery: 'Celery',
  tornado: 'Tornado',
  sanic: 'Sanic',
  aiohttp: 'aiohttp',
  bottle: 'Bottle',
  pyramid: 'Pyramid',
  streamlit: 'Streamlit',
  gradio: 'Gradio',
};

const RUBY_FRAMEWORKS: Record<string, string> = {
  rails: 'Rails',
  sinatra: 'Sinatra',
  hanami: 'Hanami',
};

const PHP_FRAMEWORKS: Record<string, string> = {
  'laravel/framework': 'Laravel',
  'symfony/framework-bundle': 'Symfony',
  'slim/slim': 'Slim',
  'cakephp/cakephp': 'CakePHP',
};

const JAVA_FRAMEWORKS: Record<string, string> = {
  'org.springframework.boot:spring-boot-starter': 'Spring Boot',
  'org.springframework.boot:spring-boot-starter-web': 'Spring Boot',
  'org.springframework:spring-core': 'Spring',
  'io.quarkus:quarkus-core': 'Quarkus',
  'io.micronaut:micronaut-core': 'Micronaut',
  'io.vertx:vertx-core': 'Vert.x',
};

const GO_FRAMEWORKS: Record<string, string> = {
  'github.com/gin-gonic/gin': 'Gin',
  'github.com/labstack/echo': 'Echo',
  'github.com/gofiber/fiber': 'Fiber',
  'github.com/go-chi/chi': 'Chi',
  'github.com/gorilla/mux': 'Gorilla Mux',
  'github.com/beego/beego': 'Beego',
};

const RUST_FRAMEWORKS: Record<string, string> = {
  'actix-web': 'Actix Web',
  axum: 'Axum',
  rocket: 'Rocket',
  warp: 'Warp',
  tide: 'Tide',
};

function matchManifestDeps(
  file: FileInput,
  depMap: Record<string, string>,
  via: string,
): DetectedFramework[] {
  if (!file.path.endsWith('package.json') && !file.path.endsWith('composer.json')) return [];
  const results: DetectedFramework[] = [];
  try {
    const pkg = JSON.parse(file.content);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.require,
      ...pkg['require-dev'],
    };
    for (const [dep, ver] of Object.entries(allDeps)) {
      const name = depMap[dep];
      if (name) {
        results.push({ name, version: ver as string, source: file.path, via });
      }
    }
  } catch {
    /* skip */
  }
  return results;
}

export function detectFrameworks(files: FileInput[]): DetectedFramework[] {
  const seen = new Set<string>();
  const results: DetectedFramework[] = [];

  function add(item: DetectedFramework) {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      results.push(item);
    }
  }

  for (const file of files) {
    // JS/TS frameworks from package.json
    for (const f of matchManifestDeps(file, JS_FRAMEWORKS, 'package.json')) add(f);

    // PHP frameworks from composer.json
    for (const f of matchManifestDeps(file, PHP_FRAMEWORKS, 'composer.json')) add(f);

    // Python frameworks from requirements/pyproject/Pipfile
    const basename = file.path.split('/').pop() || '';
    if (
      basename === 'requirements.txt' ||
      basename === 'pyproject.toml' ||
      basename === 'Pipfile' ||
      basename === 'setup.py' ||
      basename === 'setup.cfg' ||
      file.path.match(/requirements\/.*\.txt$/)
    ) {
      const content = file.content.toLowerCase();
      for (const [pkg, name] of Object.entries(PY_FRAMEWORKS)) {
        if (content.includes(pkg)) {
          add({ name, source: file.path, via: 'pip' });
        }
      }
    }

    // Ruby frameworks from Gemfile
    if (basename === 'Gemfile') {
      const gemPattern = /gem\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = gemPattern.exec(file.content)) !== null) {
        const name = RUBY_FRAMEWORKS[match[1]];
        if (name) add({ name, source: file.path, via: 'Gemfile' });
      }
      gemPattern.lastIndex = 0;
    }

    // Java frameworks from pom.xml / build.gradle
    if (basename === 'pom.xml') {
      for (const [key, name] of Object.entries(JAVA_FRAMEWORKS)) {
        if (file.content.includes(key.split(':')[1])) {
          add({ name, source: file.path, via: 'Maven' });
        }
      }
    }
    if (basename === 'build.gradle' || basename === 'build.gradle.kts') {
      for (const [key, name] of Object.entries(JAVA_FRAMEWORKS)) {
        if (file.content.includes(key)) {
          add({ name, source: file.path, via: 'Gradle' });
        }
      }
    }

    // Go frameworks from go.mod
    if (basename === 'go.mod') {
      for (const [pkg, name] of Object.entries(GO_FRAMEWORKS)) {
        if (file.content.includes(pkg)) {
          add({ name, source: file.path, via: 'go.mod' });
        }
      }
    }

    // Rust frameworks from Cargo.toml
    if (basename === 'Cargo.toml') {
      for (const [pkg, name] of Object.entries(RUST_FRAMEWORKS)) {
        const pattern = new RegExp(`^${pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`, 'm');
        if (pattern.test(file.content)) {
          add({ name, source: file.path, via: 'Cargo.toml' });
        }
      }
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Database Detection ──

const JS_DB_PACKAGES: Record<string, string> = {
  pg: 'PostgreSQL',
  'pg-pool': 'PostgreSQL',
  mysql2: 'MySQL',
  mysql: 'MySQL',
  mongoose: 'MongoDB',
  mongodb: 'MongoDB',
  redis: 'Redis',
  ioredis: 'Redis',
  prisma: 'Prisma',
  '@prisma/client': 'Prisma',
  'drizzle-orm': 'Drizzle',
  typeorm: 'TypeORM',
  sequelize: 'Sequelize',
  knex: 'Knex',
  'better-sqlite3': 'SQLite',
  sqlite3: 'SQLite',
  mssql: 'SQL Server',
  'cassandra-driver': 'Cassandra',
  neo4j: 'Neo4j',
  'neo4j-driver': 'Neo4j',
  dynamoose: 'DynamoDB',
  '@elastic/elasticsearch': 'Elasticsearch',
  'firebase-admin': 'Firebase',
};

const PY_DB_PACKAGES: Record<string, string> = {
  psycopg2: 'PostgreSQL',
  'psycopg2-binary': 'PostgreSQL',
  asyncpg: 'PostgreSQL',
  pymongo: 'MongoDB',
  motor: 'MongoDB',
  sqlalchemy: 'SQLAlchemy',
  redis: 'Redis',
  'django-redis': 'Redis',
  databases: 'Databases',
  peewee: 'Peewee',
  tortoise: 'Tortoise ORM',
  'tortoise-orm': 'Tortoise ORM',
  pymysql: 'MySQL',
  'mysql-connector-python': 'MySQL',
  cassandra: 'Cassandra',
  elasticsearch: 'Elasticsearch',
};

const RUBY_DB_GEMS: Record<string, string> = {
  pg: 'PostgreSQL',
  mysql2: 'MySQL',
  mongoid: 'MongoDB',
  redis: 'Redis',
  sequel: 'Sequel',
  activerecord: 'ActiveRecord',
};

const PHP_DB_PACKAGES: Record<string, string> = {
  'doctrine/orm': 'Doctrine',
  'doctrine/dbal': 'Doctrine',
  'predis/predis': 'Redis',
  'mongodb/mongodb': 'MongoDB',
  'illuminate/database': 'Eloquent',
};

const JAVA_DB_ARTIFACTS: Record<string, string> = {
  postgresql: 'PostgreSQL',
  'mysql-connector': 'MySQL',
  'hibernate-core': 'Hibernate',
  'spring-data-jpa': 'Spring Data JPA',
  'spring-data-mongodb': 'MongoDB',
  jedis: 'Redis',
  'mongo-java-driver': 'MongoDB',
  'elasticsearch-rest-high-level-client': 'Elasticsearch',
};

const GO_DB_PACKAGES: Record<string, string> = {
  'github.com/jackc/pgx': 'PostgreSQL',
  'github.com/lib/pq': 'PostgreSQL',
  'github.com/go-redis/redis': 'Redis',
  'github.com/redis/go-redis': 'Redis',
  'gorm.io/gorm': 'GORM',
  'go.mongodb.org/mongo-driver': 'MongoDB',
  'github.com/go-sql-driver/mysql': 'MySQL',
  'github.com/mattn/go-sqlite3': 'SQLite',
};

const RUST_DB_CRATES: Record<string, string> = {
  diesel: 'Diesel',
  sqlx: 'SQLx',
  'tokio-postgres': 'PostgreSQL',
  'sea-orm': 'SeaORM',
  mongodb: 'MongoDB',
  redis: 'Redis',
};

export function detectDatabases(files: FileInput[]): DetectedDatabase[] {
  const seen = new Set<string>();
  const results: DetectedDatabase[] = [];

  function add(item: DetectedDatabase) {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      results.push(item);
    }
  }

  for (const file of files) {
    const basename = file.path.split('/').pop() || '';

    // JS from package.json
    if (basename === 'package.json') {
      try {
        const pkg = JSON.parse(file.content);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [dep, ver] of Object.entries(allDeps)) {
          const name = JS_DB_PACKAGES[dep];
          if (name) add({ name, version: ver as string, source: file.path, via: 'npm' });
        }
      } catch {
        /* skip */
      }
    }

    // Python
    if (
      basename === 'requirements.txt' ||
      basename === 'pyproject.toml' ||
      basename === 'Pipfile' ||
      basename === 'setup.py' ||
      basename === 'setup.cfg' ||
      file.path.match(/requirements\/.*\.txt$/)
    ) {
      const content = file.content.toLowerCase();
      for (const [pkg, name] of Object.entries(PY_DB_PACKAGES)) {
        if (content.includes(pkg)) add({ name, source: file.path, via: 'pip' });
      }
    }

    // Ruby
    if (basename === 'Gemfile') {
      const gemPattern = /gem\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = gemPattern.exec(file.content)) !== null) {
        const name = RUBY_DB_GEMS[match[1]];
        if (name) add({ name, source: file.path, via: 'Gemfile' });
      }
      gemPattern.lastIndex = 0;
    }

    // PHP
    if (basename === 'composer.json') {
      try {
        const pkg = JSON.parse(file.content);
        const allDeps = { ...pkg.require, ...pkg['require-dev'] };
        for (const [dep, ver] of Object.entries(allDeps)) {
          const name = PHP_DB_PACKAGES[dep];
          if (name) add({ name, version: ver as string, source: file.path, via: 'composer' });
        }
      } catch {
        /* skip */
      }
    }

    // Java
    if (basename === 'pom.xml' || basename === 'build.gradle' || basename === 'build.gradle.kts') {
      for (const [artifact, name] of Object.entries(JAVA_DB_ARTIFACTS)) {
        if (file.content.includes(artifact)) {
          add({ name, source: file.path, via: basename === 'pom.xml' ? 'Maven' : 'Gradle' });
        }
      }
    }

    // Go
    if (basename === 'go.mod') {
      for (const [pkg, name] of Object.entries(GO_DB_PACKAGES)) {
        if (file.content.includes(pkg)) add({ name, source: file.path, via: 'go.mod' });
      }
    }

    // Rust
    if (basename === 'Cargo.toml') {
      for (const [crate, name] of Object.entries(RUST_DB_CRATES)) {
        const pattern = new RegExp(`^${crate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`, 'm');
        if (pattern.test(file.content)) {
          add({ name, source: file.path, via: 'Cargo.toml' });
        }
      }
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

// ── CI/CD & DevOps Detection ──

interface CicdPattern {
  pattern: RegExp;
  name: string;
  category: DetectedCicdTool['category'];
}

const CICD_PATH_PATTERNS: CicdPattern[] = [
  { pattern: /^\.github\/workflows\/.*\.ya?ml$/, name: 'GitHub Actions', category: 'ci' },
  { pattern: /^\.gitlab-ci\.ya?ml$/, name: 'GitLab CI', category: 'ci' },
  { pattern: /^\.circleci\//, name: 'CircleCI', category: 'ci' },
  { pattern: /^Jenkinsfile$/, name: 'Jenkins', category: 'ci' },
  { pattern: /^\.travis\.yml$/, name: 'Travis CI', category: 'ci' },
  { pattern: /^azure-pipelines\.ya?ml$/, name: 'Azure Pipelines', category: 'ci' },
  { pattern: /^bitbucket-pipelines\.yml$/, name: 'Bitbucket Pipelines', category: 'ci' },
  { pattern: /^\.buildkite\//, name: 'Buildkite', category: 'ci' },
  { pattern: /^Dockerfile(\..*)?$/, name: 'Docker', category: 'container' },
  { pattern: /^(.*\/)?Dockerfile(\..*)?$/, name: 'Docker', category: 'container' },
  { pattern: /^docker-compose\.ya?ml$/, name: 'Docker Compose', category: 'container' },
  { pattern: /^compose\.ya?ml$/, name: 'Docker Compose', category: 'container' },
  { pattern: /^\.dockerignore$/, name: 'Docker', category: 'container' },
  { pattern: /^(kubernetes|k8s)\//, name: 'Kubernetes', category: 'orchestration' },
  { pattern: /^Chart\.yaml$/, name: 'Helm', category: 'orchestration' },
  { pattern: /^(charts|helm)\/.*Chart\.yaml$/, name: 'Helm', category: 'orchestration' },
  { pattern: /^skaffold\.yaml$/, name: 'Skaffold', category: 'orchestration' },
  { pattern: /^Makefile$/, name: 'Make', category: 'build' },
  { pattern: /^Taskfile\.ya?ml$/, name: 'Task', category: 'build' },
  { pattern: /^justfile$/, name: 'Just', category: 'build' },
  { pattern: /^Earthfile$/, name: 'Earthly', category: 'build' },
  { pattern: /^pulumi\.ya?ml$/, name: 'Pulumi', category: 'iac' },
  { pattern: /^Pulumi\.\w+\.ya?ml$/, name: 'Pulumi', category: 'iac' },
  { pattern: /^serverless\.ya?ml$/, name: 'Serverless Framework', category: 'iac' },
  { pattern: /^\.terraform\.lock\.hcl$/, name: 'Terraform', category: 'iac' },
  { pattern: /^terragrunt\.hcl$/, name: 'Terragrunt', category: 'iac' },
];

export function detectCicd(files: FileInput[]): DetectedCicdTool[] {
  const seen = new Map<string, DetectedCicdTool>();

  for (const file of files) {
    for (const { pattern, name, category } of CICD_PATH_PATTERNS) {
      if (pattern.test(file.path) && !seen.has(name)) {
        seen.set(name, { name, source: file.path, category });
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Testing & Quality Detection ──

const JS_TESTING_PACKAGES: Record<
  string,
  { name: string; category: DetectedTestingTool['category'] }
> = {
  jest: { name: 'Jest', category: 'testing' },
  vitest: { name: 'Vitest', category: 'testing' },
  mocha: { name: 'Mocha', category: 'testing' },
  ava: { name: 'AVA', category: 'testing' },
  jasmine: { name: 'Jasmine', category: 'testing' },
  cypress: { name: 'Cypress', category: 'e2e' },
  playwright: { name: 'Playwright', category: 'e2e' },
  '@playwright/test': { name: 'Playwright', category: 'e2e' },
  puppeteer: { name: 'Puppeteer', category: 'e2e' },
  '@storybook/react': { name: 'Storybook', category: 'testing' },
  '@storybook/vue3': { name: 'Storybook', category: 'testing' },
  '@storybook/svelte': { name: 'Storybook', category: 'testing' },
  '@testing-library/react': { name: 'Testing Library', category: 'testing' },
  '@testing-library/jest-dom': { name: 'Testing Library', category: 'testing' },
  eslint: { name: 'ESLint', category: 'linting' },
  '@biomejs/biome': { name: 'Biome', category: 'linting' },
  prettier: { name: 'Prettier', category: 'formatting' },
  husky: { name: 'Husky', category: 'linting' },
  'lint-staged': { name: 'lint-staged', category: 'linting' },
  commitlint: { name: 'commitlint', category: 'linting' },
  '@commitlint/cli': { name: 'commitlint', category: 'linting' },
  nyc: { name: 'NYC', category: 'coverage' },
  c8: { name: 'c8', category: 'coverage' },
  '@vitest/coverage-v8': { name: 'Vitest Coverage', category: 'coverage' },
};

const PY_TESTING_PACKAGES: Record<
  string,
  { name: string; category: DetectedTestingTool['category'] }
> = {
  pytest: { name: 'pytest', category: 'testing' },
  'pytest-cov': { name: 'pytest-cov', category: 'coverage' },
  tox: { name: 'tox', category: 'testing' },
  ruff: { name: 'Ruff', category: 'linting' },
  black: { name: 'Black', category: 'formatting' },
  mypy: { name: 'mypy', category: 'linting' },
  flake8: { name: 'flake8', category: 'linting' },
  pylint: { name: 'pylint', category: 'linting' },
  bandit: { name: 'Bandit', category: 'linting' },
  isort: { name: 'isort', category: 'formatting' },
  coverage: { name: 'Coverage.py', category: 'coverage' },
};

const RUBY_TESTING_GEMS: Record<
  string,
  { name: string; category: DetectedTestingTool['category'] }
> = {
  rspec: { name: 'RSpec', category: 'testing' },
  'rspec-rails': { name: 'RSpec', category: 'testing' },
  rubocop: { name: 'RuboCop', category: 'linting' },
  simplecov: { name: 'SimpleCov', category: 'coverage' },
  cucumber: { name: 'Cucumber', category: 'e2e' },
  minitest: { name: 'Minitest', category: 'testing' },
};

const JAVA_TESTING_ARTIFACTS: Record<
  string,
  { name: string; category: DetectedTestingTool['category'] }
> = {
  junit: { name: 'JUnit', category: 'testing' },
  'junit-jupiter': { name: 'JUnit 5', category: 'testing' },
  mockito: { name: 'Mockito', category: 'testing' },
  jacoco: { name: 'JaCoCo', category: 'coverage' },
  spotbugs: { name: 'SpotBugs', category: 'linting' },
  checkstyle: { name: 'Checkstyle', category: 'linting' },
};

const GO_TESTING_PACKAGES: Record<
  string,
  { name: string; category: DetectedTestingTool['category'] }
> = {
  'github.com/stretchr/testify': { name: 'Testify', category: 'testing' },
  'github.com/onsi/ginkgo': { name: 'Ginkgo', category: 'testing' },
  'github.com/onsi/gomega': { name: 'Gomega', category: 'testing' },
  'github.com/golangci/golangci-lint': { name: 'golangci-lint', category: 'linting' },
};

interface TestingConfigPattern {
  pattern: RegExp;
  name: string;
  category: DetectedTestingTool['category'];
}

const TESTING_CONFIG_PATTERNS: TestingConfigPattern[] = [
  { pattern: /^\.eslintrc(\.(js|cjs|mjs|json|ya?ml))?$/, name: 'ESLint', category: 'linting' },
  { pattern: /^eslint\.config\.(js|cjs|mjs|ts)$/, name: 'ESLint', category: 'linting' },
  {
    pattern: /^\.prettierrc(\.(js|cjs|mjs|json|ya?ml))?$/,
    name: 'Prettier',
    category: 'formatting',
  },
  { pattern: /^prettier\.config\.(js|cjs|mjs|ts)$/, name: 'Prettier', category: 'formatting' },
  { pattern: /^jest\.config\.(js|cjs|mjs|ts|json)$/, name: 'Jest', category: 'testing' },
  { pattern: /^vitest\.config\.(js|cjs|mjs|ts)$/, name: 'Vitest', category: 'testing' },
  { pattern: /^playwright\.config\.(js|ts)$/, name: 'Playwright', category: 'e2e' },
  { pattern: /^cypress\.config\.(js|ts|cjs|mjs)$/, name: 'Cypress', category: 'e2e' },
  { pattern: /^\.storybook\//, name: 'Storybook', category: 'testing' },
  { pattern: /^biome\.json$/, name: 'Biome', category: 'linting' },
  { pattern: /^\.ruff\.toml$/, name: 'Ruff', category: 'linting' },
  { pattern: /^\.flake8$/, name: 'flake8', category: 'linting' },
  { pattern: /^\.pylintrc$/, name: 'pylint', category: 'linting' },
  { pattern: /^mypy\.ini$/, name: 'mypy', category: 'linting' },
  { pattern: /^\.mypy\.ini$/, name: 'mypy', category: 'linting' },
  { pattern: /^tox\.ini$/, name: 'tox', category: 'testing' },
  { pattern: /^\.rubocop\.yml$/, name: 'RuboCop', category: 'linting' },
  { pattern: /^\.husky\//, name: 'Husky', category: 'linting' },
  { pattern: /^commitlint\.config\.(js|cjs|mjs|ts)$/, name: 'commitlint', category: 'linting' },
  {
    pattern: /^\.commitlintrc(\.(js|cjs|mjs|json|ya?ml))?$/,
    name: 'commitlint',
    category: 'linting',
  },
];

export function detectTesting(files: FileInput[]): DetectedTestingTool[] {
  const seen = new Map<string, DetectedTestingTool>();

  function add(tool: DetectedTestingTool) {
    if (!seen.has(tool.name)) seen.set(tool.name, tool);
  }

  for (const file of files) {
    const basename = file.path.split('/').pop() || '';

    // Config file patterns
    for (const { pattern, name, category } of TESTING_CONFIG_PATTERNS) {
      if (pattern.test(file.path) || pattern.test(basename)) {
        add({ name, source: file.path, via: 'config', category });
      }
    }

    // JS from package.json
    if (basename === 'package.json') {
      try {
        const pkg = JSON.parse(file.content);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [dep] of Object.entries(allDeps)) {
          const tool = JS_TESTING_PACKAGES[dep];
          if (tool) add({ ...tool, source: file.path, via: 'npm' });
        }
      } catch {
        /* skip */
      }
    }

    // Python
    if (
      basename === 'requirements.txt' ||
      basename === 'pyproject.toml' ||
      basename === 'Pipfile' ||
      basename === 'setup.py' ||
      basename === 'setup.cfg' ||
      file.path.match(/requirements\/.*\.txt$/)
    ) {
      const content = file.content.toLowerCase();
      for (const [pkg, tool] of Object.entries(PY_TESTING_PACKAGES)) {
        if (content.includes(pkg)) add({ ...tool, source: file.path, via: 'pip' });
      }
    }

    // Ruby
    if (basename === 'Gemfile') {
      const gemPattern = /gem\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = gemPattern.exec(file.content)) !== null) {
        const tool = RUBY_TESTING_GEMS[match[1]];
        if (tool) add({ ...tool, source: file.path, via: 'Gemfile' });
      }
      gemPattern.lastIndex = 0;
    }

    // Java
    if (basename === 'pom.xml' || basename === 'build.gradle' || basename === 'build.gradle.kts') {
      for (const [artifact, tool] of Object.entries(JAVA_TESTING_ARTIFACTS)) {
        if (file.content.includes(artifact)) {
          add({ ...tool, source: file.path, via: basename === 'pom.xml' ? 'Maven' : 'Gradle' });
        }
      }
    }

    // Go
    if (basename === 'go.mod') {
      for (const [pkg, tool] of Object.entries(GO_TESTING_PACKAGES)) {
        if (file.content.includes(pkg)) add({ ...tool, source: file.path, via: 'go.mod' });
      }
    }
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── File Filtering ──

const CFN_YAML_OR_JSON = /\.(?:ya?ml|json)$/;
const CFN_PREFIX_PATTERNS = [
  /^template\./, // template.yaml, template.json
  /\.template\./, // foo.template.json
  /^cloudformation\//, // cloudformation/stack.yaml
  /^serverless\.ya?ml$/, // serverless.yml
  /^sam\.ya?ml$/, // sam.yaml
];

function isCfnTemplate(path: string): boolean {
  if (!CFN_YAML_OR_JSON.test(path)) return false;
  return CFN_PREFIX_PATTERNS.some((p) => p.test(path));
}

// Directories that should never be scanned for tech files
const SKIP_TECH_DIRS = new Set([
  'node_modules',
  'vendor',
  'bower_components',
  '__pycache__',
  '.git',
  '.next',
  '.nuxt',
  '.cache',
  '.venv',
  'venv',
  'env',
]);

function isSkippedPath(path: string): boolean {
  const segments = path.split('/');
  return segments.some((seg) => SKIP_TECH_DIRS.has(seg));
}

export function filterTechFiles(tree: TreeEntry[]): string[] {
  // Pre-filter: exclude entries inside skipped directories
  const filtered = tree.filter((e) => !isSkippedPath(e.path));

  const paths: string[] = [];

  // Package.json files (sorted by depth — root first)
  const packageJsons = filtered
    .filter((e) => e.type === 'blob' && e.path.endsWith('package.json'))
    .map((e) => e.path)
    .sort((a, b) => a.split('/').length - b.split('/').length);
  paths.push(...packageJsons);

  // Python manifests
  const pyManifests = new Set([
    'requirements.txt',
    'pyproject.toml',
    'Pipfile',
    'setup.py',
    'setup.cfg',
  ]);
  for (const entry of filtered) {
    if (entry.type !== 'blob') continue;
    const basename = entry.path.split('/').pop() || '';
    if (pyManifests.has(basename)) {
      if (!paths.includes(entry.path)) paths.push(entry.path);
    }
  }

  // requirements/*.txt
  const reqTxt = filtered
    .filter((e) => e.type === 'blob' && e.path.match(/^requirements\/.*\.txt$/))
    .map((e) => e.path);
  paths.push(...reqTxt);

  // Terraform files
  const tfFiles = filtered
    .filter(
      (e) =>
        e.type === 'blob' &&
        e.path.endsWith('.tf') &&
        e.path.match(/^(terraform\/|infra\/|[^/]+\.tf$)/),
    )
    .map((e) => e.path);
  paths.push(...tfFiles);

  // CloudFormation templates
  const cfnFiles = filtered
    .filter((e) => e.type === 'blob' && isCfnTemplate(e.path))
    .map((e) => e.path);
  paths.push(...cfnFiles);

  // Python source files (for boto3 detection)
  const pyFiles = filtered
    .filter((e) => e.type === 'blob' && e.path.endsWith('.py') && (e.size ?? 0) < 100_000)
    .map((e) => e.path);
  paths.push(...pyFiles);

  // Go modules
  const goMods = filtered
    .filter((e) => e.type === 'blob' && e.path.endsWith('go.mod'))
    .map((e) => e.path);
  paths.push(...goMods);

  // Java build files
  const javaBuild = filtered
    .filter(
      (e) =>
        e.type === 'blob' &&
        (e.path.endsWith('pom.xml') ||
          e.path.endsWith('build.gradle') ||
          e.path.endsWith('build.gradle.kts')),
    )
    .map((e) => e.path);
  paths.push(...javaBuild);

  // PHP composer.json
  const composerFiles = filtered
    .filter((e) => e.type === 'blob' && e.path.endsWith('composer.json'))
    .map((e) => e.path);
  paths.push(...composerFiles);

  // Rust Cargo.toml
  const cargoFiles = filtered
    .filter((e) => e.type === 'blob' && e.path.endsWith('Cargo.toml'))
    .map((e) => e.path);
  paths.push(...cargoFiles);

  // Ruby Gemfile
  const gemfiles = filtered
    .filter((e) => e.type === 'blob' && e.path.endsWith('Gemfile'))
    .map((e) => e.path);
  paths.push(...gemfiles);

  // Bicep files
  const bicepFiles = filtered
    .filter((e) => e.type === 'blob' && e.path.endsWith('.bicep'))
    .map((e) => e.path);
  paths.push(...bicepFiles);

  // ARM template JSON files
  const armFiles = filtered
    .filter(
      (e) =>
        e.type === 'blob' &&
        e.path.match(/\.(json)$/) &&
        (e.path.includes('arm') || e.path.includes('template') || e.path.includes('azuredeploy')),
    )
    .map((e) => e.path);
  paths.push(...armFiles);

  // CI/CD config files (shallow paths only — depth ≤ 3)
  const cicdPatterns = [
    /^\.github\/workflows\/.*\.ya?ml$/,
    /^\.gitlab-ci\.ya?ml$/,
    /^\.circleci\//,
    /^Jenkinsfile$/,
    /^\.travis\.yml$/,
    /^azure-pipelines\.ya?ml$/,
    /^bitbucket-pipelines\.yml$/,
    /^\.buildkite\//,
    /^Dockerfile(\..*)?$/,
    /^docker-compose\.ya?ml$/,
    /^compose\.ya?ml$/,
    /^\.dockerignore$/,
    /^(kubernetes|k8s)\//,
    /^Chart\.yaml$/,
    /^(charts|helm)\/.*Chart\.yaml$/,
    /^skaffold\.yaml$/,
    /^Makefile$/,
    /^Taskfile\.ya?ml$/,
    /^justfile$/,
    /^Earthfile$/,
    /^pulumi\.ya?ml$/,
    /^Pulumi\.\w+\.ya?ml$/,
    /^serverless\.ya?ml$/,
    /^\.terraform\.lock\.hcl$/,
    /^terragrunt\.hcl$/,
  ];
  for (const entry of filtered) {
    if (entry.type !== 'blob') continue;
    if (cicdPatterns.some((p) => p.test(entry.path))) {
      if (!paths.includes(entry.path)) paths.push(entry.path);
    }
  }

  // Testing/quality config files
  const testingConfigPatterns = [
    /^\.eslintrc/,
    /^eslint\.config\./,
    /^\.prettierrc/,
    /^prettier\.config\./,
    /^jest\.config\./,
    /^vitest\.config\./,
    /^playwright\.config\./,
    /^cypress\.config\./,
    /^\.storybook\//,
    /^biome\.json$/,
    /^\.ruff\.toml$/,
    /^\.flake8$/,
    /^\.pylintrc$/,
    /^mypy\.ini$/,
    /^\.mypy\.ini$/,
    /^tox\.ini$/,
    /^\.rubocop\.yml$/,
    /^\.husky\//,
    /^commitlint\.config\./,
    /^\.commitlintrc/,
  ];
  for (const entry of filtered) {
    if (entry.type !== 'blob') continue;
    const basename = entry.path.split('/').pop() || '';
    if (testingConfigPatterns.some((p) => p.test(entry.path) || p.test(basename))) {
      if (!paths.includes(entry.path)) paths.push(entry.path);
    }
  }

  return [...new Set(paths)];
}

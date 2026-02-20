import type { TreeEntry } from '../../types';
import type {
  DetectedAWSService,
  DetectedPythonPackage,
  DetectedAzureService,
  DetectedGCPService,
  DetectedPackage,
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

const MAX_TECH_FILES = 60;

export function filterTechFiles(tree: TreeEntry[]): string[] {
  const paths: string[] = [];

  // Package.json files (root + workspace)
  const packageJsons = tree
    .filter((e) => e.type === 'blob' && e.path.endsWith('package.json'))
    .map((e) => e.path)
    .sort((a, b) => a.split('/').length - b.split('/').length)
    .slice(0, 6); // root + up to 5 workspace packages
  paths.push(...packageJsons);

  // Python manifests
  const pyManifests = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg'];
  for (const entry of tree) {
    if (entry.type !== 'blob') continue;
    const basename = entry.path.split('/').pop() || '';
    if (pyManifests.includes(basename) && entry.path.split('/').length <= 2) {
      if (!paths.includes(entry.path)) paths.push(entry.path);
    }
  }

  // requirements/*.txt
  const reqTxt = tree
    .filter((e) => e.type === 'blob' && e.path.match(/^requirements\/.*\.txt$/))
    .map((e) => e.path)
    .slice(0, 5);
  paths.push(...reqTxt);

  // Terraform files
  const tfFiles = tree
    .filter(
      (e) =>
        e.type === 'blob' &&
        e.path.endsWith('.tf') &&
        e.path.match(/^(terraform\/|infra\/|[^/]+\.tf$)/),
    )
    .map((e) => e.path)
    .slice(0, 20);
  paths.push(...tfFiles);

  // CloudFormation templates
  const cfnFiles = tree
    .filter((e) => e.type === 'blob' && isCfnTemplate(e.path))
    .map((e) => e.path)
    .slice(0, 10);
  paths.push(...cfnFiles);

  // Python source files (for boto3 detection — limit to a manageable set)
  const pyFiles = tree
    .filter((e) => e.type === 'blob' && e.path.endsWith('.py') && (e.size ?? 0) < 100_000)
    .map((e) => e.path)
    .slice(0, 15);
  paths.push(...pyFiles);

  // Go modules
  const goMods = tree
    .filter((e) => e.type === 'blob' && e.path.endsWith('go.mod') && e.path.split('/').length <= 3)
    .map((e) => e.path)
    .slice(0, 3);
  paths.push(...goMods);

  // Java build files
  const javaBuild = tree
    .filter(
      (e) =>
        e.type === 'blob' &&
        (e.path.endsWith('pom.xml') ||
          e.path.endsWith('build.gradle') ||
          e.path.endsWith('build.gradle.kts')) &&
        e.path.split('/').length <= 3,
    )
    .map((e) => e.path)
    .slice(0, 5);
  paths.push(...javaBuild);

  // PHP composer.json
  const composerFiles = tree
    .filter(
      (e) => e.type === 'blob' && e.path.endsWith('composer.json') && e.path.split('/').length <= 3,
    )
    .map((e) => e.path)
    .slice(0, 3);
  paths.push(...composerFiles);

  // Rust Cargo.toml
  const cargoFiles = tree
    .filter(
      (e) => e.type === 'blob' && e.path.endsWith('Cargo.toml') && e.path.split('/').length <= 3,
    )
    .map((e) => e.path)
    .slice(0, 3);
  paths.push(...cargoFiles);

  // Ruby Gemfile
  const gemfiles = tree
    .filter((e) => e.type === 'blob' && e.path.endsWith('Gemfile') && e.path.split('/').length <= 3)
    .map((e) => e.path)
    .slice(0, 2);
  paths.push(...gemfiles);

  // Bicep files
  const bicepFiles = tree
    .filter((e) => e.type === 'blob' && e.path.endsWith('.bicep') && e.path.split('/').length <= 3)
    .map((e) => e.path)
    .slice(0, 5);
  paths.push(...bicepFiles);

  // ARM template JSON files
  const armFiles = tree
    .filter(
      (e) =>
        e.type === 'blob' &&
        e.path.match(/\.(json)$/) &&
        (e.path.includes('arm') || e.path.includes('template') || e.path.includes('azuredeploy')) &&
        e.path.split('/').length <= 3,
    )
    .map((e) => e.path)
    .slice(0, 5);
  paths.push(...armFiles);

  // Deduplicate and cap
  return [...new Set(paths)].slice(0, MAX_TECH_FILES);
}

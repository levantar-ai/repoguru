export type TechDetectStep =
  | 'idle'
  | 'fetching-tree'
  | 'fetching-files'
  | 'analyzing'
  | 'done'
  | 'error';

export interface DetectedAWSService {
  service: string;
  sdkPackage?: string;
  source: string;
  via: 'js-sdk-v3' | 'js-sdk-v2' | 'boto3' | 'cloudformation' | 'terraform' | 'cdk';
}

export interface DetectedAzureService {
  service: string;
  sdkPackage?: string;
  source: string;
  via: 'terraform' | 'arm-template' | 'bicep' | 'npm-sdk' | 'python-sdk';
}

export interface DetectedGCPService {
  service: string;
  sdkPackage?: string;
  source: string;
  via: 'terraform' | 'npm-sdk' | 'python-sdk';
}

export interface DetectedPythonPackage {
  name: string;
  version?: string;
  source: string;
}

export interface DetectedPackage {
  name: string;
  version?: string;
  source: string;
}

export interface DetectedFramework {
  name: string;
  version?: string;
  source: string;
  via: string;
}

export interface DetectedDatabase {
  name: string;
  version?: string;
  source: string;
  via: string;
}

export interface DetectedCicdTool {
  name: string;
  source: string;
  category: 'ci' | 'container' | 'orchestration' | 'build' | 'iac';
}

export interface DetectedTestingTool {
  name: string;
  source: string;
  via: string;
  category: 'testing' | 'e2e' | 'linting' | 'formatting' | 'coverage';
}

export interface TechDetectResult {
  aws: DetectedAWSService[];
  azure: DetectedAzureService[];
  gcp: DetectedGCPService[];
  python: DetectedPythonPackage[];
  node: DetectedPackage[];
  go: DetectedPackage[];
  java: DetectedPackage[];
  php: DetectedPackage[];
  rust: DetectedPackage[];
  ruby: DetectedPackage[];
  frameworks: DetectedFramework[];
  databases: DetectedDatabase[];
  cicd: DetectedCicdTool[];
  testing: DetectedTestingTool[];
  languages: Record<string, number>;
  manifestFiles: string[];
  totalFiles: number;
}

export interface TechDetectState {
  step: TechDetectStep;
  progress: number;
  subProgress: number;
  statusMessage: string;
  result: TechDetectResult | null;
  error: string | null;
}

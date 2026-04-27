// Tech detection result types — emitted by the in-browser detector and
// the Rust CLI's DetectTech RPC. Lifted into @repoguru/core so the
// shared `<TechDetectView />` in @repoguru/ui can consume it.

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

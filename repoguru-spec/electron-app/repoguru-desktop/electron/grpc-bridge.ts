import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { join } from 'path';
import { app } from 'electron';
import { existsSync } from 'fs';

function getProtoPath(): string {
  // Dev mode: proto is in the repo root
  const devPath = join(__dirname, '..', '..', 'proto', 'repoanalyze.proto');
  if (existsSync(devPath)) return devPath;
  // Also try one level up (common in worktree layouts)
  const altDevPath = join(__dirname, '..', 'proto', 'repoanalyze.proto');
  if (existsSync(altDevPath)) return altDevPath;
  // Packaged: proto bundled in resources
  return join(process.resourcesPath, 'proto', 'repoanalyze.proto');
}

const PROTO_PATH = getProtoPath();

type ServiceClient = grpc.Client & Record<string, Function>;

export class GrpcBridge {
  private client: ServiceClient | null = null;
  private port: number;

  constructor(port: number) {
    this.port = port;
  }

  async connect(): Promise<void> {
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto = grpc.loadPackageDefinition(packageDefinition);
    const service = (proto.repoanalyze as any).v1.RepoAnalyzeService;

    this.client = new service(
      `[::1]:${this.port}`,
      grpc.credentials.createInsecure(),
    ) as ServiceClient;

    // Wait for the channel to connect
    await new Promise<void>((resolve, reject) => {
      const deadline = new Date(Date.now() + 5000);
      this.client!.waitForReady(deadline, (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  reconnect(port: number): Promise<void> {
    this.close();
    this.port = port;
    return this.connect();
  }

  close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  // ── Unary RPC helper ──

  private call<Req, Res>(method: string, request: Req): Promise<Res> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not connected'));
      }
      (this.client as any)[method](request, (err: grpc.ServiceError | null, response: Res) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  }

  // ── Streaming RPC helper ──

  private stream<Req, Res>(
    method: string,
    request: Req,
    onData: (data: Res) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('gRPC client not connected'));
      }
      const call = (this.client as any)[method](request);
      call.on('data', (data: Res) => onData(data));
      call.on('end', () => resolve());
      call.on('error', (err: Error) => reject(err));
    });
  }

  // ── Public API ──

  scan(req: unknown, onProgress: (p: unknown) => void): Promise<void> {
    return this.stream('Scan', req, onProgress);
  }

  describeScan(outPath: string): Promise<unknown> {
    return this.call('DescribeScan', { out_path: outPath });
  }

  getSection(outPath: string, section: string, repoPath?: string): Promise<unknown> {
    return this.call('GetSection', { out_path: outPath, section, repo_path: repoPath });
  }

  getReport(outPath: string): Promise<unknown> {
    return this.call('GetReport', { out_path: outPath });
  }

  listSections(): Promise<unknown> {
    return this.call('ListSections', {});
  }

  scoreReportCard(repoPath: string, outPath?: string): Promise<unknown> {
    return this.call('ScoreReportCard', { repo_path: repoPath, out_path: outPath });
  }

  evaluatePolicy(preset: string, customPolicy?: unknown, reportCard?: unknown): Promise<unknown> {
    return this.call('EvaluatePolicy', {
      preset,
      custom_policy: customPolicy,
      report_card: reportCard,
    });
  }

  detectTech(repoPath: string): Promise<unknown> {
    return this.call('DetectTech', { repo_path: repoPath });
  }

  generateSBOM(repoPath: string, format?: string): Promise<unknown> {
    return this.call('GenerateSBOM', { repo_path: repoPath, format: format ?? 'cyclonedx-json' });
  }

  exportReport(format: string, reportCard: unknown, repoName: string): Promise<unknown> {
    return this.call('ExportReport', {
      format,
      report_card: reportCard,
      repo_name: repoName,
    });
  }

  scanOrg(req: unknown, onProgress: (p: unknown) => void): Promise<void> {
    return this.stream('ScanOrg', req, onProgress);
  }

  compareRepos(pathA: string, pathB: string): Promise<unknown> {
    return this.call('CompareRepos', { repo_path_a: pathA, repo_path_b: pathB });
  }

  health(): Promise<unknown> {
    return this.call('Health', {});
  }
}

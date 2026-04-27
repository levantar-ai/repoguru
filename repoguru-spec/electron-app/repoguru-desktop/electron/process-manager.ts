import { ChildProcess, spawn } from 'child_process';
import { join } from 'path';
import { app } from 'electron';

// Ensure child processes die when Electron exits unexpectedly
process.on('exit', () => {
  try { process.kill(0, 'SIGTERM'); } catch {}
});

const LISTENING_PATTERN = /LISTENING ON \[::1\]:(\d+)/;
const MAX_BACKOFF_MS = 30_000;
const STARTUP_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

export class ProcessManager {
  private process: ChildProcess | null = null;
  private port: number = 0;
  private backoffMs: number = 1_000;
  private restartCount: number = 0;
  private stopping: boolean = false;
  private onCrash: (() => void) | null = null;

  /**
   * Resolve the path to the embedded repoanalyze binary for the current platform.
   */
  private getBinaryPath(): string {
    const platform = process.platform;
    const arch = process.arch;

    let binaryName: string;
    if (platform === 'win32') {
      binaryName = 'repoanalyze-win32-x86_64.exe';
    } else if (platform === 'darwin') {
      binaryName = arch === 'arm64'
        ? 'repoanalyze-darwin-aarch64'
        : 'repoanalyze-darwin-x86_64';
    } else {
      binaryName = 'repoanalyze-linux-x86_64';
    }

    if (app.isPackaged) {
      return join(process.resourcesPath, 'bin', binaryName);
    }
    // Dev mode: look in resources/bin
    return join(__dirname, '..', 'resources', 'bin', binaryName);
  }

  /**
   * Start the Rust binary and wait for it to report its listening port.
   */
  async start(): Promise<number> {
    this.stopping = false;
    this.port = await this.spawnAndWaitForPort();
    return this.port;
  }

  private spawnAndWaitForPort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const binaryPath = this.getBinaryPath();
      const child = spawn(binaryPath, ['serve', '--listen', '[::1]:0'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        // Kill child when parent dies (Linux: prctl PR_SET_PDEATHSIG via detached=false)
        detached: false,
      });

      this.process = child;
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill('SIGKILL');
          reject(new Error(`Rust binary did not report listening port within ${STARTUP_TIMEOUT_MS}ms`));
        }
      }, STARTUP_TIMEOUT_MS);

      child.stdout!.on('data', (data: Buffer) => {
        const line = data.toString();
        const match = line.match(LISTENING_PATTERN);
        if (match && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.backoffMs = 1_000;
          this.restartCount = 0;
          resolve(parseInt(match[1], 10));
        }
      });

      child.stderr!.on('data', (data: Buffer) => {
        console.error('[repoanalyze stderr]', data.toString());
      });

      child.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      child.on('exit', (code, signal) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Rust binary exited during startup: code=${code}, signal=${signal}`));
        } else if (!this.stopping) {
          console.error(`[repoanalyze] process exited: code=${code}, signal=${signal} — scheduling restart`);
          this.scheduleRestart();
        }
      });
    });
  }

  private scheduleRestart(): void {
    if (this.stopping) return;

    this.restartCount++;
    console.log(`[repoanalyze] restart #${this.restartCount} in ${this.backoffMs}ms`);

    setTimeout(async () => {
      if (this.stopping) return;
      try {
        this.port = await this.spawnAndWaitForPort();
        console.log(`[repoanalyze] restarted on port ${this.port}`);
        this.onCrash?.();
      } catch (err) {
        console.error('[repoanalyze] restart failed:', err);
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
        this.scheduleRestart();
      }
    }, this.backoffMs);

    this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
  }

  /**
   * Gracefully stop the Rust binary: SIGTERM → wait → SIGKILL.
   */
  async stop(): Promise<void> {
    this.stopping = true;
    const child = this.process;
    if (!child || child.exitCode !== null) return;

    return new Promise<void>((resolve) => {
      const forceKill = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, SHUTDOWN_TIMEOUT_MS);

      child.on('exit', () => {
        clearTimeout(forceKill);
        resolve();
      });

      child.kill('SIGTERM');
    });
  }

  getPort(): number {
    return this.port;
  }

  isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  /**
   * Register a callback for when the process crashes and restarts.
   * The GrpcBridge uses this to reconnect.
   */
  onRestart(callback: () => void): void {
    this.onCrash = callback;
  }
}

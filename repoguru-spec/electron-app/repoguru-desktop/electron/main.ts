import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { randomUUID, createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { request as httpsRequest } from 'node:https';
import type { OutgoingHttpHeaders } from 'node:http';
import { ProcessManager } from './process-manager';
import { GrpcBridge } from './grpc-bridge';

// Parallels' GPU passthrough is flaky and Chromium's GPU process dying
// takes the network service down with it (the user got "TypeError: fetch
// failed" right after a GPU crash). Software rendering is plenty fast
// for our UI and dodges the entire problem.
app.disableHardwareAcceleration();

// Lightweight Node-native HTTPS POST/GET that doesn't share fate with
// Chromium's network service — survives even if Electron's GPU crashes.
function nodeHttpsRequest(url: string, opts: { method?: string; headers?: OutgoingHttpHeaders; body?: string } = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest({
      method: opts.method || 'GET',
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: opts.headers,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf-8') }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

/** Single git stderr line emitted during a clone or fetch. We surface
 *  it to the renderer so the progress bar reflects real network /
 *  delta-resolution state instead of pretending nothing is happening. */
export interface GitProgress {
  phase: string;          // "Receiving objects" / "Resolving deltas" / "Counting objects" / …
  percent?: number;       // 0–100, when git includes a percentage
  current?: number;       // current object count, when present
  total?: number;         // total object count, when present
  rate?: string;          // transfer rate, when present (e.g. "5.20 MiB/s")
  message: string;        // raw line, trimmed
}

/** Parse a single line of git's --progress stderr output.
 *  Examples:
 *    "Receiving objects:  73% (12345/16789), 4.50 MiB | 2.10 MiB/s"
 *    "Resolving deltas: 100% (7234/7234), done."
 *    "remote: Counting objects: 100% (1234/1234), done."
 *    "Cloning into '/tmp/x'..."
 *  Returns null when the line carries no actionable progress. */
function parseGitProgress(line: string): GitProgress | null {
  const cleaned = line.replace(/^remote:\s*/, '').trim();
  if (!cleaned) return null;
  const m = cleaned.match(/^([A-Za-z][A-Za-z ]+?):\s+(\d+)%(?:\s+\((\d+)\/(\d+)\))?(?:.*?\|\s*([\d.]+\s*[KMGT]?i?B\/s))?/);
  if (!m) {
    // Lines like "Cloning into '...'" — surface as a phase tag without %
    if (/^Cloning into/.test(cleaned)) return { phase: 'Connecting', message: cleaned };
    return null;
  }
  return {
    phase: m[1],
    percent: parseInt(m[2], 10),
    current: m[3] ? parseInt(m[3], 10) : undefined,
    total: m[4] ? parseInt(m[4], 10) : undefined,
    rate: m[5],
    message: cleaned,
  };
}

function runGit(args: string[], onProgress?: (p: GitProgress) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let buf = '';
    proc.stderr.on('data', (d) => {
      const chunk = d.toString();
      stderr += chunk;
      if (!onProgress) return;
      // git emits progress lines terminated by \r (carriage return) so
      // a single line gets overwritten in-place on a tty. Split on
      // either \r or \n to capture every update, not just the final one.
      buf += chunk;
      const parts = buf.split(/[\r\n]/);
      buf = parts.pop() ?? '';
      for (const line of parts) {
        const p = parseGitProgress(line);
        if (p) onProgress(p);
      }
    });
    proc.on('error', (err) => reject(new Error(`git failed: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      // Strip the embedded token from any error output before surfacing
      else reject(new Error(`git ${args[0]} exited ${code}: ${stderr.replace(/x-access-token:[^@]+@/g, '<token>@').slice(0, 500)}`));
    });
  });
}

function renderCallbackHtml(opts: { ok: boolean; message: string }): string {
  const color = opts.ok ? '#22c55e' : '#ef4444';
  const title = opts.ok ? 'Connected to GitHub' : 'GitHub authorization failed';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  html,body{margin:0;height:100%;background:#0b0d12;color:#e5e7eb;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{height:100%;display:flex;align-items:center;justify-content:center}
  .card{max-width:420px;padding:32px;border:1px solid #1f2937;border-radius:12px;text-align:center;background:#111827}
  h1{font-size:18px;margin:0 0 12px;color:${color}}
  p{font-size:14px;color:#9ca3af;margin:8px 0}
  small{font-size:12px;color:#6b7280}
</style></head><body><div class="wrap"><div class="card">
<h1>${title}</h1><p>${opts.message}</p>
<small>RepoGuru Desktop</small>
</div></div><script>setTimeout(()=>window.close(),1500)</script></body></html>`;
}

// Secure store helpers (encrypted file in userData)
function getSecureStorePath(): string {
  return join(app.getPath('userData'), 'secure-store.json');
}

function loadSecureStore(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(getSecureStorePath(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveSecureStore(store: Record<string, string>): void {
  const dir = app.getPath('userData');
  mkdirSync(dir, { recursive: true });
  writeFileSync(getSecureStorePath(), JSON.stringify(store));
}

let mainWindow: BrowserWindow | null = null;
let processManager: ProcessManager | null = null;
let grpcBridge: GrpcBridge | null = null;

const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'RepoGuru',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startBackend(): Promise<void> {
  processManager = new ProcessManager();
  const port = await processManager.start();

  grpcBridge = new GrpcBridge(port);
  await grpcBridge.connect();

  // Auto-reconnect gRPC bridge when process restarts after crash
  processManager.onRestart(async () => {
    const newPort = processManager!.getPort();
    try {
      await grpcBridge!.reconnect(newPort);
      console.log(`[grpc-bridge] reconnected on port ${newPort}`);
      mainWindow?.webContents.send('backend:reconnected');
    } catch (err) {
      console.error('[grpc-bridge] reconnect failed:', err);
      mainWindow?.webContents.send('backend:error', String(err));
    }
  });

  registerIpcHandlers();
}

function registerIpcHandlers(): void {
  if (!grpcBridge) return;
  const bridge = grpcBridge;

  // Scan
  ipcMain.handle('scan', async (_event, req) => {
    return bridge.scan(req, (progress) => {
      mainWindow?.webContents.send('scan:progress', progress);
    });
  });

  ipcMain.handle('describeScan', async (_event, outPath: string) => {
    return bridge.describeScan(outPath);
  });

  ipcMain.handle('getSection', async (_event, outPath: string, section: string, repoPath?: string) => {
    return bridge.getSection(outPath, section, repoPath);
  });

  ipcMain.handle('getReport', async (_event, outPath: string) => {
    return bridge.getReport(outPath);
  });

  ipcMain.handle('listSections', async () => {
    return bridge.listSections();
  });

  // Report Card
  ipcMain.handle('scoreReportCard', async (_event, repoPath: string, outPath?: string) => {
    return bridge.scoreReportCard(repoPath, outPath);
  });

  // Policy
  ipcMain.handle('evaluatePolicy', async (_event, preset: string, reportCard: unknown) => {
    return bridge.evaluatePolicy(preset, undefined, reportCard);
  });

  ipcMain.handle('evaluatePolicyCustom', async (_event, policy: unknown, reportCard: unknown) => {
    return bridge.evaluatePolicy('', policy, reportCard);
  });

  // Tech & SBOM
  ipcMain.handle('detectTech', async (_event, repoPath: string) => {
    return bridge.detectTech(repoPath);
  });

  ipcMain.handle('generateSBOM', async (_event, repoPath: string, format?: string) => {
    return bridge.generateSBOM(repoPath, format);
  });

  // Export
  ipcMain.handle('exportReport', async (_event, format: string, reportCard: unknown, repoName: string) => {
    return bridge.exportReport(format, reportCard, repoName);
  });

  // Org Scan
  ipcMain.handle('scanOrg', async (_event, req) => {
    return bridge.scanOrg(req, (progress) => {
      mainWindow?.webContents.send('scanOrg:progress', progress);
    });
  });

  // Compare
  ipcMain.handle('compareRepos', async (_event, pathA: string, pathB: string) => {
    return bridge.compareRepos(pathA, pathB);
  });

  // System
  ipcMain.handle('health', async () => {
    return bridge.health();
  });

  // Note: selectDirectory, openExternal, and secure storage handlers
  // are registered immediately in app.whenReady() since they don't need gRPC
}

app.whenReady().then(async () => {
  createWindow();

  // Register non-gRPC IPC handlers immediately (don't wait for backend)
  ipcMain.handle('selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Secure token storage (doesn't need gRPC)
  ipcMain.handle('secureStore', async (_event, key: string, value: string) => {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value);
      const store = loadSecureStore();
      store[key] = encrypted.toString('base64');
      saveSecureStore(store);
    } else {
      return { fallback: true };
    }
    return { fallback: false };
  });

  ipcMain.handle('secureLoad', async (_event, key: string) => {
    if (safeStorage.isEncryptionAvailable()) {
      const store = loadSecureStore();
      const encoded = store[key];
      if (!encoded) return { value: '', fallback: false };
      try {
        const decrypted = safeStorage.decryptString(Buffer.from(encoded, 'base64'));
        return { value: decrypted, fallback: false };
      } catch {
        return { value: '', fallback: false };
      }
    }
    return { value: '', fallback: true };
  });

  ipcMain.handle('secureDelete', async (_event, key: string) => {
    if (safeStorage.isEncryptionAvailable()) {
      const store = loadSecureStore();
      delete store[key];
      saveSecureStore(store);
    }
    return { fallback: !safeStorage.isEncryptionAvailable() };
  });

  ipcMain.handle('secureHas', async (_event, key: string) => {
    if (safeStorage.isEncryptionAvailable()) {
      const store = loadSecureStore();
      return { has: !!store[key], fallback: false };
    }
    return { has: false, fallback: true };
  });

  // GitHub OAuth — loopback HTTP server + the user's REAL default browser
  // (RFC 8252 native-app OAuth pattern). We:
  //   1. Bind a tiny HTTP server on 127.0.0.1 with an OS-assigned port
  //   2. Open https://github.com/login/oauth/authorize?... in the user's
  //      default browser via shell.openExternal — they're already signed
  //      in there with their full set of passkeys / password manager /
  //      2FA, so the auth flow is exactly as smooth as the web app's
  //   3. Pass redirect_uri=http://127.0.0.1:PORT/oauth/callback so GitHub
  //      sends the user back to our local server with ?code=&state=
  //   4. Capture, validate state, exchange via the same CORS proxy the
  //      web uses, return token, render a "you can close this tab" page,
  //      shut down the server.
  // No embedded webview (so no partial-passkey warning), no codes to
  // copy, no Device Flow toggle. The App's callback-URL list does need
  // http://127.0.0.1 (any port) registered as a permitted callback —
  // that's a one-time setting on the GitHub App.
  let oauthInFlight: { server: Server; cleanup: () => void } | null = null;

  ipcMain.handle('githubOAuthBrowser', async (_event, args: { clientId: string; corsProxy: string }) => {
    const { clientId, corsProxy } = args;
    if (!clientId) throw new Error('GitHub OAuth not configured (no client_id).');
    if (oauthInFlight) {
      try { oauthInFlight.cleanup(); } catch { /* ignore */ }
      oauthInFlight = null;
    }

    const state = randomUUID();
    const scope = 'repo read:org';

    return new Promise<{ token: string }>((resolve, reject) => {
      let settled = false;
      const server = createServer((req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://127.0.0.1');
          if (url.pathname !== '/oauth/callback') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
          }
          const code = url.searchParams.get('code');
          const stateParam = url.searchParams.get('state');
          const ghError = url.searchParams.get('error_description') || url.searchParams.get('error');

          if (ghError) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(renderCallbackHtml({ ok: false, message: ghError }));
            settle(new Error(ghError));
            return;
          }
          if (!code || stateParam !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(renderCallbackHtml({ ok: false, message: 'Invalid OAuth callback (state mismatch).' }));
            settle(new Error('OAuth state mismatch — possible CSRF, please try again.'));
            return;
          }

          // Render the success page right away so the user sees a clean
          // close-this-tab message; exchange the code in parallel.
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(renderCallbackHtml({ ok: true, message: 'You can close this tab and return to RepoGuru.' }));

          (async () => {
            try {
              const tokenRes = await nodeHttpsRequest(`${corsProxy}/api/oauth/token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // CORS proxy enforces a browser-style Origin allowlist;
                  // without it server-to-server requests get 403. Use the
                  // apex domain that's already whitelisted for the web app.
                  'Origin': 'https://repo.guru',
                },
                body: JSON.stringify({ code }),
              });
              let data: { access_token?: string; error?: string; error_description?: string } = {};
              try { data = JSON.parse(tokenRes.body); } catch { /* keep empty */ }
              if (tokenRes.status < 200 || tokenRes.status >= 300 || !data.access_token) {
                throw new Error(data.error_description || data.error || `Token exchange failed (HTTP ${tokenRes.status})`);
              }
              settle(null, data.access_token);
            } catch (err) {
              settle(err instanceof Error ? err : new Error(String(err)));
            }
          })();
        } catch (err) {
          settle(err instanceof Error ? err : new Error(String(err)));
        }
      });

      const settle = (err: Error | null, token?: string) => {
        if (settled) return;
        settled = true;
        try { server.close(); } catch { /* ignore */ }
        if (oauthInFlight?.server === server) oauthInFlight = null;
        if (err) reject(err);
        else if (token) resolve({ token });
        else reject(new Error('OAuth flow ended without token'));
      };

      // 5-minute hard cap so we don't hold a server open forever.
      const timeout = setTimeout(() => settle(new Error('GitHub authorization timed out.')), 5 * 60 * 1000);

      // Fixed port so the App's callback-URL list only needs ONE entry
      // (not one per random ephemeral port). 47821 is unassigned by IANA
      // and unlikely to clash with anything else on the user's machine.
      const FIXED_PORT = 47821;

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          settle(new Error(`Port ${FIXED_PORT} is busy — close whatever's using it and try Connect again.`));
        } else {
          settle(err);
        }
      });
      // Bind to 127.0.0.1 and use the same hostname in redirect_uri.
      // GitHub does exact host-string matching against the App's
      // registered callback URLs, so the hostname spelling here MUST
      // match exactly what's saved on the App ("127.0.0.1" — not
      // "localhost", even though they resolve identically).
      server.listen(FIXED_PORT, '127.0.0.1', () => {
        const port = (server.address() as AddressInfo).port;
        const redirectUri = `http://127.0.0.1:${port}/oauth/callback`;
        const authUrl =
          `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
          `&scope=${encodeURIComponent(scope)}` +
          `&state=${encodeURIComponent(state)}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}`;
        oauthInFlight = {
          server,
          cleanup: () => {
            // Triggered by githubOAuthCancel — close the server AND
            // reject the awaiting Promise so the renderer can move
            // out of its "Waiting for GitHub…" state. Without the
            // settle() call, closing the browser would leave the
            // Promise pending until the 5-minute timeout fires.
            clearTimeout(timeout);
            settle(new Error('Cancelled by user'));
          },
        };
        // Open in the user's default browser — passkeys, password
        // managers, 2FA all work the way they normally do.
        shell.openExternal(authUrl).catch((err) => settle(err));
      });
    });
  });

  ipcMain.handle('githubOAuthCancel', async () => {
    if (oauthInFlight) {
      try { oauthInFlight.cleanup(); } catch { /* ignore */ }
      oauthInFlight = null;
    }
  });

  // List the user's repos — done in main so we sidestep any CORS edge
  // cases and so failures bubble up as real errors (the renderer-side
  // fetch was silently swallowing 401s, leaving the picker blank).
  ipcMain.handle('githubListRepos', async (_event, token: string) => {
    if (!token) throw new Error('No GitHub token');
    const res = await nodeHttpsRequest('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'RepoGuru-Desktop',
      },
    });
    if (res.status === 401) {
      // Token is rejected (expired/revoked). Drop it from secureStore so the
      // picker shows Connect again instead of looping on bad credentials.
      try {
        const store = loadSecureStore();
        delete store['repoguru:github-token'];
        saveSecureStore(store);
      } catch { /* ignore */ }
      throw new Error('Reconnect to GitHub — your saved session is no longer valid.');
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`GitHub API ${res.status}: ${res.body.slice(0, 300)}`);
    }
    const json = JSON.parse(res.body) as Array<{
      name: string;
      full_name: string;
      description: string | null;
      language: string | null;
      stargazers_count: number;
      owner: { login: string };
    }>;
    return json.map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      description: r.description ?? undefined,
      language: r.language ?? undefined,
      stars: r.stargazers_count,
      ownerLabel: r.owner.login,
    }));
  });

  // Clone a GitHub repo to a deterministic temp folder so the local CLI
  // (which only knows how to scan filesystem paths) can run against it.
  // Reused across score/compare/git-stats/tech-detect/policy. If the
  // repo already exists on disk we skip the clone (idempotent).
  ipcMain.handle('githubCloneRepo', async (_event, args: { slug: string; token?: string }) => {
    const { slug, token } = args;
    if (!/^[A-Za-z0-9][\w.-]*\/[\w.-]+$/.test(slug)) {
      throw new Error(`Not a valid GitHub slug: ${slug}`);
    }
    // Hash the slug to keep the path safe regardless of weird chars; cache
    // dir is per-slug so multiple repos co-exist.
    const safe = createHash('sha1').update(slug).digest('hex').slice(0, 12);
    const cacheRoot = join(tmpdir(), 'repoguru-cache');
    mkdirSync(cacheRoot, { recursive: true });
    const dest = join(cacheRoot, `${slug.replace('/', '__')}-${safe}`);

    // Forward git's per-line stderr progress to the renderer via a
    // dedicated channel. Replaces --quiet, which silenced everything
    // and left the UI bar stuck at 1% until the clone finished.
    const sendProgress = (p: GitProgress) => {
      mainWindow?.webContents.send('clone:progress', { slug, ...p });
    };

    // Build the clone URL. For private repos the user-token gets
    // embedded as the basic-auth username (GitHub recipe). Public repos
    // work without it but pass the token anyway when present so we hit
    // the higher rate-limit bucket.
    const repoUrl = token
      ? `https://x-access-token:${token}@github.com/${slug}.git`
      : `https://github.com/${slug}.git`;

    // If the clone already exists and looks like a git repo, fast-path
    // to a `git fetch` so we get any new commits without re-cloning.
    // Refresh origin to the CURRENT token URL first — the cached
    // clone's stored remote may carry an expired token from a previous
    // session ("Authentication failed for ..."). If the refresh fetch
    // still fails (network, revoked token, etc.) fall through and use
    // the existing snapshot rather than failing the whole analysis.
    if (existsSync(join(dest, '.git'))) {
      sendProgress({ phase: 'Updating', message: 'Updating cached clone…' });
      try {
        await runGit(['-C', dest, 'remote', 'set-url', 'origin', repoUrl]);
        await runGit(['-C', dest, 'fetch', '--progress', 'origin'], sendProgress);
        sendProgress({ phase: 'Updating', percent: 100, message: 'Updated cached clone.' });
      } catch (err) {
        console.warn(`[clone] fetch failed for ${slug}, using cached snapshot:`, err);
        sendProgress({
          phase: 'Updating',
          percent: 100,
          message: 'Using cached snapshot (fetch failed).',
        });
      }
      return { path: dest };
    }

    sendProgress({ phase: 'Connecting', message: `Cloning ${slug}…` });
    await runGit(['clone', '--progress', repoUrl, dest], sendProgress);
    sendProgress({ phase: 'Receiving objects', percent: 100, message: 'Clone complete.' });
    return { path: dest };
  });

  try {
    await startBackend();
    console.log('[main] Backend ready, IPC handlers registered');
    mainWindow?.webContents.send('backend:ready');
  } catch (err) {
    console.error('Failed to start backend:', err);
    mainWindow?.webContents.send('backend:error', String(err));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (grpcBridge) {
    grpcBridge.close();
  }
  if (processManager) {
    await processManager.stop();
  }
});

// Catch unexpected exits and ensure child processes are cleaned up
process.on('SIGTERM', () => {
  processManager?.stop().finally(() => process.exit(0));
});
process.on('SIGINT', () => {
  processManager?.stop().finally(() => process.exit(0));
});
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception:', err);
  processManager?.stop().finally(() => process.exit(1));
});

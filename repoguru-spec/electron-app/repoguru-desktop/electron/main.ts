import { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { ProcessManager } from './process-manager';
import { GrpcBridge } from './grpc-bridge';

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

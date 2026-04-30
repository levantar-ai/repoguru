import { contextBridge, ipcRenderer } from 'electron';

export interface ScanRequest {
  repo_path: string;
  out_path: string;
  threads?: number;
  merge_policy?: string;
  renames?: boolean;
  copies?: boolean;
  rename_threshold?: number;
  include_remotes?: boolean;
  max_top?: number;
  report?: boolean;
  max_diff_files?: number;
  merge_diff_limit?: number;
  worker_cache_mb?: number;
}

export interface ScanProgress {
  phase: string;
  message: string;
  commits_processed: number;
  file_changes_processed: number;
  elapsed_seconds: number;
  done: boolean;
  error: string;
}

export interface OrgScanRequest {
  org_or_user: string;
  is_user: boolean;
  github_token: string;
  clone_base_dir: string;
  max_repos: number;
  skip_forks: boolean;
  skip_archived: boolean;
}

export interface RepoGuruAPI {
  // Scan
  scan(req: ScanRequest, onProgress: (p: ScanProgress) => void): Promise<void>;
  describeScan(outPath: string): Promise<unknown>;
  getSection(outPath: string, section: string, repoPath?: string): Promise<unknown>;
  getReport(outPath: string): Promise<unknown>;
  listSections(): Promise<unknown>;

  // Report Card
  scoreReportCard(repoPath: string, outPath?: string): Promise<unknown>;

  // Policy
  evaluatePolicy(preset: string, reportCard: unknown): Promise<unknown>;
  evaluatePolicyCustom(policy: unknown, reportCard: unknown): Promise<unknown>;

  // Tech & SBOM
  detectTech(repoPath: string): Promise<unknown>;
  generateSBOM(repoPath: string, format?: string): Promise<unknown>;

  // Export
  exportReport(format: string, reportCard: unknown, repoName: string): Promise<unknown>;

  // Org Scan
  scanOrg(req: OrgScanRequest, onProgress: (p: unknown) => void): Promise<void>;

  // Compare
  compareRepos(pathA: string, pathB: string): Promise<unknown>;

  // System
  health(): Promise<unknown>;
  selectDirectory(): Promise<string | null>;
  openExternal(url: string): Promise<void>;

  // Secure storage
  secureStore(key: string, value: string): Promise<{ fallback: boolean }>;
  secureLoad(key: string): Promise<{ value: string; fallback: boolean }>;
  secureDelete(key: string): Promise<{ fallback: boolean }>;
  secureHas(key: string): Promise<{ has: boolean; fallback: boolean }>;

  // GitHub OAuth — opens GitHub's authorize URL in the user's default
  // browser, captures the redirect on a localhost loopback server,
  // exchanges the code via the CORS proxy, returns the token. Same
  // flow desktop OAuth tools (gh CLI, gcloud, etc.) use.
  githubOAuthBrowser(args: { clientId: string; corsProxy: string }): Promise<{ token: string }>;
  githubOAuthCancel(): Promise<void>;
  githubListRepos(token: string): Promise<Array<{
    owner: string;
    repo: string;
    description?: string;
    language?: string;
    stars?: number;
    ownerLabel?: string;
  }>>;
  githubCloneRepo(args: { slug: string; token?: string }): Promise<{ path: string }>;
}

const api: RepoGuruAPI = {
  // Scan
  scan(req, onProgress) {
    const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => {
      onProgress(progress);
    };
    ipcRenderer.on('scan:progress', listener);
    return ipcRenderer.invoke('scan', req).finally(() => {
      ipcRenderer.removeListener('scan:progress', listener);
    });
  },

  describeScan(outPath) {
    return ipcRenderer.invoke('describeScan', outPath);
  },

  getSection(outPath, section, repoPath?) {
    return ipcRenderer.invoke('getSection', outPath, section, repoPath);
  },

  getReport(outPath) {
    return ipcRenderer.invoke('getReport', outPath);
  },

  listSections() {
    return ipcRenderer.invoke('listSections');
  },

  // Report Card
  scoreReportCard(repoPath, outPath?) {
    return ipcRenderer.invoke('scoreReportCard', repoPath, outPath);
  },

  // Policy
  evaluatePolicy(preset, reportCard) {
    return ipcRenderer.invoke('evaluatePolicy', preset, reportCard);
  },

  evaluatePolicyCustom(policy, reportCard) {
    return ipcRenderer.invoke('evaluatePolicyCustom', policy, reportCard);
  },

  // Tech & SBOM
  detectTech(repoPath) {
    return ipcRenderer.invoke('detectTech', repoPath);
  },

  generateSBOM(repoPath, format?) {
    return ipcRenderer.invoke('generateSBOM', repoPath, format);
  },

  // Export
  exportReport(format, reportCard, repoName) {
    return ipcRenderer.invoke('exportReport', format, reportCard, repoName);
  },

  // Org Scan
  scanOrg(req, onProgress) {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      onProgress(progress);
    };
    ipcRenderer.on('scanOrg:progress', listener);
    return ipcRenderer.invoke('scanOrg', req).finally(() => {
      ipcRenderer.removeListener('scanOrg:progress', listener);
    });
  },

  // Compare
  compareRepos(pathA, pathB) {
    return ipcRenderer.invoke('compareRepos', pathA, pathB);
  },

  // System
  health() {
    return ipcRenderer.invoke('health');
  },

  selectDirectory() {
    return ipcRenderer.invoke('selectDirectory');
  },

  openExternal(url) {
    return ipcRenderer.invoke('openExternal', url);
  },

  // Secure storage
  secureStore(key, value) {
    return ipcRenderer.invoke('secureStore', key, value);
  },
  secureLoad(key) {
    return ipcRenderer.invoke('secureLoad', key);
  },
  secureDelete(key) {
    return ipcRenderer.invoke('secureDelete', key);
  },
  secureHas(key) {
    return ipcRenderer.invoke('secureHas', key);
  },

  // OAuth (loopback HTTP server + system browser)
  githubOAuthBrowser(args) {
    return ipcRenderer.invoke('githubOAuthBrowser', args);
  },
  githubOAuthCancel() {
    return ipcRenderer.invoke('githubOAuthCancel');
  },
  githubListRepos(token) {
    return ipcRenderer.invoke('githubListRepos', token);
  },
  githubCloneRepo(args) {
    return ipcRenderer.invoke('githubCloneRepo', args);
  },
};

contextBridge.exposeInMainWorld('repoGuru', api);

declare global {
  interface Window {
    repoGuru: RepoGuruAPI;
  }
}

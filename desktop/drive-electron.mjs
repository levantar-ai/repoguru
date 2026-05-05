// Playwright-Electron driver for the actual Electron desktop build.
//
// What this proves (per the user's directive):
//   1. The page chrome inside Electron matches the web app (same React
//      tree mounted from @repoguru/ui).
//   2. The Git Stats scan flow shows the double progress bar (overall +
//      sub-progress) the same way the web app does.
//   3. The desktop scans ALL commits, not the browser's 1000-cap. We
//      scan the local /tmp/react clone (34k+ commits) and confirm the
//      reported "Total Commits" overview > 1000.
//
// Run (after `pnpm build:renderer` so dist/ is up-to-date):
//   node drive-electron.mjs
//
// Captures: dist/electron-shot-{index}-{name}.png
import { _electron as electron } from '/home/parallels/Development/repoguru-unified/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTDIR = path.resolve(__dirname, '..', '..', '..', 'electron-shots');
mkdirSync(OUTDIR, { recursive: true });

const TARGET_REPO = '/tmp/react';

console.log('Launching Electron from', __dirname);
const app = await electron.launch({
  cwd: __dirname,
  args: ['.'],
});
app.process().stdout?.on('data', (d) => process.stderr.write(`[electron stdout] ${d}`));
app.process().stderr?.on('data', (d) => process.stderr.write(`[electron stderr] ${d}`));
const win = await app.firstWindow();
win.on('console', (m) => process.stderr.write(`[renderer console] ${m.type()}: ${m.text()}\n`));
win.on('pageerror', (e) => process.stderr.write(`[renderer error] ${e}\n`));
await win.waitForLoadState('domcontentloaded');

// Wait for backend (Rust gRPC sidecar spawned by Electron's main process)
// to be ready before driving the UI — health() invokes the IPC handler that
// only registers after startBackend() resolves.
console.log('Waiting for Electron backend to be ready (sidecar startup)…');
const backendReadyAt = Date.now();
for (;;) {
  if (Date.now() - backendReadyAt > 60_000) {
    throw new Error('Backend never became ready within 60s');
  }
  const ready = await win.evaluate(async () => {
    try {
      await window.repoGuru.health();
      return true;
    } catch {
      return false;
    }
  }).catch(() => false);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 500));
}
console.log('  → backend up after', ((Date.now() - backendReadyAt) / 1000).toFixed(1), 's');

let n = 0;
const shot = async (name) => {
  const file = path.join(OUTDIR, `${String(n++).padStart(2, '0')}-${name}.png`);
  await win.screenshot({ path: file, fullPage: true });
  console.log('  →', file);
};

console.log('1) Capture Dashboard');
await shot('dashboard');

console.log('2) Navigate to Git Stats');
await win.evaluate(() => { window.location.hash = '#/git-stats'; });
await new Promise((r) => setTimeout(r, 800));
await shot('gitstats-empty');

console.log(`3) Fill repo path: ${TARGET_REPO}`);
await win.evaluate((repo) => {
  const input = document.getElementById('git-stats-repo');
  if (!input) throw new Error('git-stats-repo input not found');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, repo);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, TARGET_REPO);
await shot('gitstats-filled');

console.log('4) Click "Analyze Git Stats"');
await win.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent.trim() === 'Analyze Git Stats' && b.className.includes('bg-neon'),
  );
  if (!btn) throw new Error('Analyze button not found');
  btn.click();
});

// Capture the in-flight "loading" frame quickly to record the progress
// chrome, then wait for analysis to complete.
await new Promise((r) => setTimeout(r, 800));
await shot('gitstats-scanning-early');

console.log('5) Polling for scan completion (this can take a while on react/34k commits)…');
const start = Date.now();
const TIMEOUT_MS = 600_000; // 10 minutes
let lastMessage = '';
let totalCommits = null;
while (Date.now() - start < TIMEOUT_MS) {
  await new Promise((r) => setTimeout(r, 4000));
  const status = await win.evaluate(() => {
    const main = document.querySelector('main');
    const text = main?.textContent ?? '';
    const visibleSpinner = !!document.querySelector('.animate-spin');
    const hasOverview = text.includes('Total Commits') || text.includes('Total commits');
    // Try to find the loading message
    const msgEl = main?.querySelector('span.text-text-secondary');
    const msg = msgEl?.textContent?.trim() ?? '';
    return { visibleSpinner, hasOverview, msg, length: text.length };
  });
  if (status.msg && status.msg !== lastMessage) {
    console.log('   progress:', status.msg);
    lastMessage = status.msg;
  }
  if (status.hasOverview) break;
  if (!status.visibleSpinner && status.length > 1500) {
    // Finished but no overview text — could be error
    break;
  }
}

console.log('6) Capture finished dashboard');
await shot('gitstats-done-top');

// Try to grab Total Commits from the executive summary block
totalCommits = await win.evaluate(() => {
  const main = document.querySelector('main');
  if (!main) return null;
  const txt = main.textContent ?? '';
  const m = txt.match(/Total Commits[^\d]*(\d[\d,]*)/i);
  return m ? m[1].replace(/,/g, '') : null;
});
console.log('   Total Commits scanned:', totalCommits);

// Scroll through and capture additional sections to prove the dashboard
// is the same view as the web.
const scrollCaptures = ['executive', 'patterns', 'authors', 'codebase', 'health'];
for (const label of scrollCaptures) {
  await win.evaluate((y) => window.scrollBy(0, y), 800);
  await new Promise((r) => setTimeout(r, 300));
  await shot(`gitstats-section-${label}`);
}

console.log('Closing Electron');
await app.close();

console.log('\n=== Result ===');
console.log('Total commits reported by desktop scan of /tmp/react:', totalCommits);
console.log('Browser cap: 1000');
console.log(totalCommits && Number(totalCommits) > 1000
  ? '✅ Desktop scan exceeded the 1000-commit browser cap.'
  : '❌ Desktop scan did NOT exceed 1000 commits — investigate.');
console.log('Screenshots in', OUTDIR);

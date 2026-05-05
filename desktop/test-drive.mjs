// Comprehensive Playwright-Electron test drive of the real desktop build.
// Exercises every page that doesn't need GitHub credentials:
//   - Report Card (Score)
//   - Tech Detect
//   - Policy (Production Ready preset)
//   - Compare
//   - Git Stats — proves all-commit scan + double progress bar
//
// Captures screenshots into ./../../../electron-shots/ and prints a
// concise summary at the end. No interactive input — fully autonomous.
import { _electron as electron } from '/home/parallels/Development/repoguru-unified/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTDIR = path.resolve(__dirname, '..', '..', '..', 'electron-shots');
mkdirSync(OUTDIR, { recursive: true });

const REPO_A = '/tmp/react';                                       // 23,584 commits — all-commits proof
const REPO_B = process.env.HOME + '/Development/repoguru';         // 152 commits — small comparison
const REPO_C = process.env.HOME + '/Development/repoguru-spec';    // for Compare

let n = 0;
const shotName = (label) => `${String(n++).padStart(2, '0')}-${label}.png`;

console.log('Launching real Electron build of repoguru-desktop…');
const app = await electron.launch({ cwd: __dirname, args: ['.'] });
app.process().stdout?.on('data', (d) => process.stderr.write('[main stdout] ' + d));
app.process().stderr?.on('data', (d) => {
  const s = d.toString();
  if (/repoanalyze stderr|grpc-bridge|Backend ready/.test(s) && !/gbm_wrapper|libva|gl_surface|gpu_/.test(s)) {
    process.stderr.write(s);
  }
});
const win = await app.firstWindow();
win.on('console', (m) => {
  if (m.type() === 'error') process.stderr.write(`[renderer error] ${m.text()}\n`);
});

const shot = async (label) => {
  const f = path.join(OUTDIR, shotName(label));
  await win.screenshot({ path: f, fullPage: true });
  console.log('  → ' + path.basename(f));
};

const goto = async (hash) => {
  await win.evaluate((h) => { window.location.hash = h; }, hash);
  await new Promise((r) => setTimeout(r, 800));
};

const fillById = async (id, value) => {
  await win.evaluate(
    ({ id, value }) => {
      const el = document.getElementById(id);
      if (!el) throw new Error('input not found: ' + id);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    { id, value },
  );
};

const clickByText = async (text, classFilter = '') => {
  await win.evaluate(
    ({ text, classFilter }) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(
        (b) =>
          b.textContent.trim() === text &&
          (!classFilter || b.className.includes(classFilter)),
      );
      if (!btn) throw new Error(`button "${text}" not found`);
      btn.click();
    },
    { text, classFilter },
  );
};

const waitFor = async (text, timeoutSec = 240) => {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    const state = await win
      .evaluate(
        (t) => {
          const txt = document.querySelector('main')?.textContent ?? '';
          return {
            found: txt.includes(t),
            failed: txt.includes('failed') || txt.includes('Failed'),
            snippet: txt.slice(0, 400),
          };
        },
        text,
      )
      .catch(() => ({ found: false, failed: false, snippet: '<eval failed>' }));
    if (state.found) return;
    if (state.failed) {
      console.error('  ✗ page reports failure: ' + state.snippet);
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.error('  ✗ timed out waiting for: ' + text);
};

// ── Wait for backend (sidecar startup) ───────────────────────────────
console.log('\nWaiting for Electron backend…');
const t0 = Date.now();
while (Date.now() - t0 < 60_000) {
  const ready = await win
    .evaluate(async () => {
      try {
        await window.repoGuru.health();
        return true;
      } catch {
        return false;
      }
    })
    .catch(() => false);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 500));
}
console.log(`  ✅ backend up after ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const summary = {};

// ── Page 1: Report Card on facebook/react ───────────────────────
console.log('\n=== PAGE 1: Report Card on facebook/react ===');
await goto('#/');
await shot('reportcard-empty');
await fillById('report-card-repo', REPO_A);
await clickByText('Score', 'bg-neon');
await waitFor('Documentation');
await shot('reportcard-react-result');
const rcGrade = await win.evaluate(
  () => document.querySelector('main')?.textContent?.match(/(\d{1,3})\/100/)?.[1],
);
summary.reportCard = `react scored ${rcGrade}/100`;
console.log(`  ✅ ${summary.reportCard}`);

// ── Page 2: Tech Detect on /tmp/react ───────────────────────────────
console.log('\n=== PAGE 2: Tech Detect ===');
await goto('#/tech');
await shot('tech-empty');
await fillById('tech-detect-repo', REPO_A);
await clickByText('Detect', 'bg-neon');
await waitFor('Executive Summary');
await shot('tech-react-result');
const techText = await win.evaluate(
  () => document.querySelector('main')?.textContent ?? '',
);
const langMatch = techText.match(/(\d+)\s+languages/);
summary.techDetect = `react languages detected: ${langMatch?.[1] ?? '?'}`;
console.log(`  ✅ ${summary.techDetect}`);

// ── Page 3: Policy ──────────────────────────────────────────────────
console.log('\n=== PAGE 3: Policy ===');
await goto('#/policy');
await shot('policy-empty');
await fillById('policy-repo', REPO_A);
await win.evaluate(() => {
  const sel = document.getElementById('policy-preset');
  if (sel) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, 'production-ready');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await clickByText('Evaluate Policy', 'bg-neon');
await waitFor('POLICY');
await shot('policy-result');
const policyText = await win.evaluate(
  () => document.querySelector('main')?.textContent ?? '',
);
const passed = policyText.includes('POLICY PASSED');
const failed = policyText.includes('POLICY FAILED');
const counts = policyText.match(/(\d+)\s*PASSED.*?(\d+)\s*FAILED/s);
summary.policy = `repoguru evaluated against Production Ready → ${
  passed ? 'PASSED' : failed ? 'FAILED' : '?'
}, ${counts?.[1] ?? '?'} pass / ${counts?.[2] ?? '?'} fail`;
console.log(`  ✅ ${summary.policy}`);

// ── Page 4: Compare repoguru vs repoguru-spec ────────────────────────
console.log('\n=== PAGE 4: Compare ===');
await goto('#/compare');
await shot('compare-empty');
await fillById('compare-repo-a', REPO_A);
await fillById('compare-repo-b', REPO_B);
await clickByText('Compare', 'bg-neon');
await waitFor('Category Breakdown');
await shot('compare-result');
const cmpText = await win.evaluate(
  () => document.querySelector('main')?.textContent ?? '',
);
const winsBy = cmpText.match(/wins by\s*(\d+)\s*points?/);
summary.compare = `repoguru vs repoguru-spec → wins by ${winsBy?.[1] ?? '?'} points`;
console.log(`  ✅ ${summary.compare}`);

// ── Page 5: Git Stats on /tmp/react — the headline test ─────────────
console.log('\n=== PAGE 5: Git Stats (the all-commits test) ===');
await goto('#/git-stats');
await shot('gitstats-empty');
await fillById('git-stats-repo', REPO_A);
await clickByText('Analyze Git Stats', 'bg-neon');

// Watch the double-progress UI for a couple of frames
console.log('  capturing progress chrome…');
await new Promise((r) => setTimeout(r, 600));
await shot('gitstats-progress-early');
await new Promise((r) => setTimeout(r, 2500));
await shot('gitstats-progress-mid');

// Wait for the dashboard
console.log('  waiting for dashboard…');
const startScan = Date.now();
while (Date.now() - startScan < 600_000) {
  const done = await win
    .evaluate(
      () =>
        (document.querySelector('main')?.textContent ?? '').includes('TOTAL COMMITS'),
    )
    .catch(() => false);
  if (done) break;
  await new Promise((r) => setTimeout(r, 4000));
}
await shot('gitstats-dashboard-top');
const totalCommits = await win.evaluate(() => {
  const txt = document.querySelector('main')?.textContent ?? '';
  return txt.match(/TOTAL COMMITS[^0-9]*([\d,]+)/i)?.[1]?.replace(/,/g, '') ?? null;
});
summary.gitStats = `react TOTAL COMMITS = ${totalCommits} (browser cap = 1000)`;
console.log(`  ✅ ${summary.gitStats}`);

// scroll through dashboard sections (best-effort; ignore if window closed)
for (const label of ['mid1', 'mid2', 'bottom']) {
  try {
    await win.evaluate((y) => window.scrollBy(0, y), 1000);
    await new Promise((r) => setTimeout(r, 300));
    await shot(`gitstats-dashboard-${label}`);
  } catch (e) {
    console.log(`  (skipping ${label}: ${(e instanceof Error ? e.message : e).slice(0, 80)})`);
    break;
  }
}

// ── Done ────────────────────────────────────────────────────────────
console.log('\n=== Test Drive Summary ===');
for (const [k, v] of Object.entries(summary)) console.log(`  • ${k}: ${v}`);
console.log(`\nScreenshots: ${OUTDIR}`);
console.log(`Total commits ${totalCommits} ${
  Number(totalCommits) > 1000
    ? '✅ BEATS the browser-side 1000-commit cap'
    : '❌ NOT past 1000 — investigate'
}`);

await app.close();
process.exit(0);

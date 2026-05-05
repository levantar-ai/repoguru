// Focused Electron drive: scan /tmp/react (facebook/react) on Report Card
// and Git Stats only, capturing the dashboards.
import { _electron as electron } from '/home/parallels/Development/repoguru-unified/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', '..', '..', 'electron-shots');
mkdirSync(OUT, { recursive: true });

const REPO = '/tmp/react';

console.log('launching Electron…');
const app = await electron.launch({ cwd: __dirname, args: ['.'] });
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');

// wait for backend
for (let i = 0; i < 60; i++) {
  if (await win.evaluate(async () => {
    try { await window.repoGuru.health(); return true; } catch { return false; }
  })) break;
  await new Promise((r) => setTimeout(r, 500));
}
console.log('backend up');

let n = 0;
const shot = async (label) => {
  const f = path.join(OUT, `react-${String(n++).padStart(2, '0')}-${label}.png`);
  await win.screenshot({ path: f, fullPage: true });
  console.log('  →', path.basename(f));
};

// ── Report Card on facebook/react ──
console.log('--- REPORT CARD on facebook/react ---');
await win.evaluate(() => { window.location.hash = '#/'; });
await new Promise((r) => setTimeout(r, 800));
await shot('rc-empty');
await win.evaluate((repo) => {
  const i = document.getElementById('report-card-repo');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(i, repo);
  i.dispatchEvent(new Event('input', { bubbles: true }));
}, REPO);
await win.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Score' && b.className.includes('bg-neon'));
  b.click();
});

// wait for dashboard with category sections
for (let i = 0; i < 120; i++) {
  if (await win.evaluate(() => (document.querySelector('main')?.textContent ?? '').includes('Documentation'))) break;
  await new Promise((r) => setTimeout(r, 1000));
}
await shot('rc-result');
const rcInfo = await win.evaluate(() => {
  const t = document.querySelector('main')?.textContent ?? '';
  return {
    score: t.match(/(\d{1,3})\s*\/\s*100/)?.[1],
    grade: t.match(/[A-F]\b\s*\d{1,3}\/100/)?.[0]?.[0],
    repo: t.match(/^([A-Za-z0-9_./-]+\/[A-Za-z0-9_.-]+)/)?.[1],
  };
});
console.log('  Report Card →', rcInfo);

// ── Git Stats on facebook/react ──
console.log('--- GIT STATS on facebook/react ---');
await win.evaluate(() => { window.location.hash = '#/git-stats'; });
await new Promise((r) => setTimeout(r, 800));
await shot('gs-empty');
await win.evaluate((repo) => {
  const i = document.getElementById('git-stats-repo');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(i, repo);
  i.dispatchEvent(new Event('input', { bubbles: true }));
}, REPO);
await win.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button'))
    .find(b => b.textContent.trim() === 'Analyze Git Stats' && b.className.includes('bg-neon'));
  b.click();
});
// capture progress
await new Promise((r) => setTimeout(r, 700));
await shot('gs-progress-1');
await new Promise((r) => setTimeout(r, 3500));
await shot('gs-progress-2');

// wait for dashboard
for (let i = 0; i < 200; i++) {
  if (await win.evaluate(() => (document.querySelector('main')?.textContent ?? '').includes('TOTAL COMMITS'))) break;
  await new Promise((r) => setTimeout(r, 2000));
}
await shot('gs-dash-top');
const gsInfo = await win.evaluate(() => {
  const t = document.querySelector('main')?.textContent ?? '';
  const get = (re) => t.match(re)?.[1];
  return {
    totalCommits: get(/TOTAL COMMITS\s*([\d,]+)/i),
    contributors: get(/CONTRIBUTORS\s*([\d,]+)/i),
    busFactor: get(/BUS FACTOR\s*(\d+)/i),
    languages: get(/LANGUAGES\s*(\d+)/i),
    repoAge: get(/REPO AGE\s*([\dy ms]+?)(?:\s|$)/i),
    health: get(/(\d{1,3})\s*[\n]?\s*[A-F]\s*\n?Health Score/i) ?? get(/Health Score[^]{0,100}?(\d{1,3})/i),
  };
});
console.log('  Git Stats →', gsInfo);
for (const lab of ['mid1', 'mid2', 'bottom']) {
  try {
    await win.evaluate((y) => window.scrollBy(0, y), 1000);
    await new Promise((r) => setTimeout(r, 300));
    await shot(`gs-${lab}`);
  } catch (e) { break; }
}

await app.close();
console.log('\n✅ DONE');

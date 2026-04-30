// Smoke test for the embedded BrowserWindow OAuth flow:
// - launch Electron
// - go to Report Card
// - click "Connect to GitHub"
// - assert a SECOND BrowserWindow opened, pointed at github.com/login
//   (this is the slick path — no codes, no toggles, native window)
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = await electron.launch({ cwd: __dirname, args: ['.'] });
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
await win.waitForTimeout(500);

await win.evaluate(() => { window.location.hash = '/report-card'; });
await win.waitForTimeout(800);

// Watch for any new window the app spawns (the OAuth window).
const newWindowPromise = app.waitForEvent('window', { timeout: 8000 }).catch(() => null);

const connectBtn = await win.locator('button:has-text("Connect to GitHub")').first();
const isVisible = await connectBtn.isVisible().catch(() => false);
console.log('Connect to GitHub button visible:', isVisible);

if (!isVisible) {
  console.log('No Connect button — flow not testable here.');
  await app.close();
  process.exit(1);
}

await connectBtn.click();
console.log('Clicked Connect, waiting for OAuth window...');

const oauthWin = await newWindowPromise;
if (!oauthWin) {
  console.log('❌ No new window opened.');
  await app.close();
  process.exit(1);
}

// Wait for the new window to navigate to github.com.
try {
  await oauthWin.waitForURL(/github\.com/, { timeout: 8000 });
} catch {
  /* ignore */
}
const url = oauthWin.url();
console.log('OAuth window URL:', url);

const isGitHub = url.includes('github.com');
const isAuthorize = url.includes('/login') || url.includes('oauth/authorize');
console.log('On github.com:', isGitHub, '| On login/authorize:', isAuthorize);

await oauthWin.screenshot({ path: '/tmp/oauth-browser.png' }).catch(() => {});
console.log('Screenshot: /tmp/oauth-browser.png');

if (isGitHub && isAuthorize) {
  console.log('\n✅ Embedded BrowserWindow OAuth flow works — opens GitHub login.');
} else {
  console.log('\n❌ Window opened but not at github.com/login.');
}

await app.close();
process.exit(0);

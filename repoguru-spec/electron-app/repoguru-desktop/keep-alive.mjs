// Launches Electron via Playwright and just keeps the connection open
// indefinitely so the user can drive the app while the sandbox holds
// the parent process alive. Press Ctrl-C in the terminal that owns the
// Bash call (or close the Electron window) to stop.
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('Launching Electron…');
const app = await electron.launch({ cwd: __dirname, args: ['.'] });
const win = await app.firstWindow();
await win.waitForLoadState('domcontentloaded');
console.log('Electron is up. Window stays open for user driving.');
console.log('Backend log: /tmp/electron-user.log');
console.log('Press Ctrl-C to terminate.');

// Forward stderr from sidecar so the host's logs stream out
app.process().stderr?.on('data', (d) => {
  const s = d.toString();
  if (/repoanalyze stderr|grpc-bridge|main/.test(s) && !/gbm_wrapper|libva|gl_surface|gpu_/.test(s)) {
    process.stderr.write(s);
  }
});

// Hold open until the app or window closes
await new Promise((resolve) => {
  app.on('close', resolve);
  win.on('close', resolve);
});
console.log('Electron closed; exiting.');
process.exit(0);

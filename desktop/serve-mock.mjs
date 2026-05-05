// Serves the desktop renderer (dist/) with a mock window.repoGuru bridge
// pre-injected into index.html so the React tree can run in a regular browser.
// Each call returns the canned CLI response captured by probe-capture.mjs.
//
// Run after `pnpm build:renderer`:
//   node serve-mock.mjs               # http://127.0.0.1:5174
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, 'dist');
const FIXTURES = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'fixtures.json'), 'utf-8'));
const PORT = Number(process.env.PORT) || 5174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// The mock bridge: every IPC method returns the canned fixture, irrespective
// of arguments. Methods we haven't captured return either an empty success
// shape or a rejection — both fine for a single-page screenshot run.
const BRIDGE_BODY = `(function(){
  const fixtures = ${JSON.stringify(FIXTURES)};
  function deferred(value){ return new Promise(r => setTimeout(() => r(value), 50)); }
  window.repoGuru = {
    scan: () => deferred(undefined),
    describeScan: () => deferred({}),
    getSection: () => deferred({}),
    getReport: () => deferred({}),
    listSections: () => deferred([]),
    scoreReportCard: () => deferred(fixtures.scoreReportCard.response),
    evaluatePolicy: () => deferred(fixtures.evaluatePolicy.response),
    evaluatePolicyCustom: () => deferred(fixtures.evaluatePolicy.response),
    detectTech: () => deferred(fixtures.detectTech.response),
    generateSBOM: () => deferred({ format: 'cyclonedx-json', content: '{}', component_count: 0 }),
    exportReport: () => deferred({ content: 'mock' }),
    scanOrg: () => deferred(undefined),
    compareRepos: () => deferred(fixtures.compareRepos.response),
    health: () => deferred({ ok: true }),
    selectDirectory: () => deferred(null),
    openExternal: () => deferred(undefined),
    secureStore: () => deferred({ fallback: false }),
    secureLoad: () => deferred({ value: '', fallback: false }),
    secureDelete: () => deferred({ fallback: false }),
    secureHas: () => deferred({ has: false, fallback: false }),
  };
})();
`;
const BRIDGE_SCRIPT = '<script src="/__mock_bridge.js"></script>';

function rewriteHtml(buf) {
  // Strip Electron's CSP meta — it blocks inline scripts and would forbid the
  // mock bridge. The local mock environment is trusted.
  let html = String(buf).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\s*/i, '');
  html = html.replace('</head>', BRIDGE_SCRIPT + '</head>');
  return html;
}

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  if (url === '/__mock_bridge.js') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
    return res.end(BRIDGE_BODY);
  }
  const filePath = path.join(DIST, url);
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      const idx = path.join(DIST, 'index.html');
      fs.readFile(idx, (err2, html) => {
        if (err2) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(rewriteHtml(html));
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(rewriteHtml(data));
    } else {
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Mock desktop renderer at http://127.0.0.1:' + PORT);
});

interface Env {
  ALLOWED_ORIGINS: string; // comma-separated, supports wildcards: "https://*.example.com,http://localhost:5173"
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ── Origin check ──
    const origin = request.headers.get('Origin');
    const patterns = parseAllowedOrigins(env.ALLOWED_ORIGINS);

    if (!origin || !isAllowed(origin, patterns)) {
      return new Response('Forbidden', { status: 403 });
    }

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);
    // Path format: /github.com/owner/repo.git/info/refs?service=...
    const target = url.pathname.slice(1) + url.search;

    // Security: only proxy to github.com
    if (!target.startsWith('github.com/')) {
      return new Response('Only github.com targets are allowed', { status: 403 });
    }

    const targetUrl = `https://${target}`;

    // Forward the request to GitHub
    const upstreamHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (
        key === 'content-type' ||
        key === 'git-protocol' ||
        key === 'accept'
      ) {
        upstreamHeaders.set(key, value);
      }
    }
    upstreamHeaders.set('User-Agent', 'repoguru-git-proxy');

    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: request.method === 'POST' ? request.body : undefined,
    });

    // Stream the response back with CORS headers
    const responseHeaders = corsHeaders(origin);
    responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/octet-stream');
    if (upstream.headers.has('Cache-Control')) {
      responseHeaders.set('Cache-Control', upstream.headers.get('Cache-Control')!);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  },
};

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isAllowed(origin: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern === origin) return true;
    // Wildcard: "https://*.example.com" matches "https://foo.example.com"
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]+') + '$');
      if (regex.test(origin)) return true;
    }
  }
  return false;
}

function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Git-Protocol, Accept');
  headers.set('Access-Control-Expose-Headers', 'Content-Type');
  headers.set('Vary', 'Origin');
  return headers;
}

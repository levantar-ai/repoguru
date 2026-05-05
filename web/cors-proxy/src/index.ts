interface Env {
  ALLOWED_ORIGINS: string; // comma-separated, supports wildcards: "https://*.example.com,http://localhost:5173"
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
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
    const path = url.pathname;

    // ── OAuth token exchange ──
    if (path === '/api/oauth/token' && request.method === 'POST') {
      return handleOAuthTokenExchange(request, env, origin);
    }

    // Path format: /github.com/owner/repo.git/info/refs?service=...
    const target = path.slice(1) + url.search;

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
        key === 'accept' ||
        key === 'authorization'
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

async function handleOAuthTokenExchange(
  request: Request,
  env: Env,
  origin: string,
): Promise<Response> {
  const json = (headers: Headers) => {
    headers.set('Content-Type', 'application/json');
    return headers;
  };

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: json(corsHeaders(origin)),
    });
  }

  if (!body.code || typeof body.code !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing required field: code' }), {
      status: 400,
      headers: json(corsHeaders(origin)),
    });
  }

  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return new Response(JSON.stringify({ error: 'OAuth not configured on server' }), {
      status: 500,
      headers: json(corsHeaders(origin)),
    });
  }

  const ghResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'repoguru-git-proxy',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code: body.code,
    }),
  });

  if (!ghResponse.ok) {
    return new Response(
      JSON.stringify({ error: 'GitHub token exchange failed', status: ghResponse.status }),
      { status: 502, headers: json(corsHeaders(origin)) },
    );
  }

  const ghData: { access_token?: string; token_type?: string; error?: string; error_description?: string } =
    await ghResponse.json();

  if (ghData.error || !ghData.access_token) {
    return new Response(
      JSON.stringify({ error: ghData.error_description || ghData.error || 'Token exchange failed' }),
      { status: 400, headers: json(corsHeaders(origin)) },
    );
  }

  return new Response(
    JSON.stringify({ access_token: ghData.access_token, token_type: ghData.token_type }),
    { status: 200, headers: json(corsHeaders(origin)) },
  );
}

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
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Git-Protocol, Accept, Authorization');
  headers.set('Access-Control-Expose-Headers', 'Content-Type');
  headers.set('Vary', 'Origin');
  return headers;
}

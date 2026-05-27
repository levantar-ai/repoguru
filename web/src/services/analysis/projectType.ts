import type { FileContent, TreeEntry } from '../../types';

/** Coarse classification of what kind of project a repo is. Drives
 *  per-signal `notApplicable` decisions across the analysers — e.g.
 *  Dockerfile is a fail on a server, irrelevant on a CSS library.
 *
 *  Intentionally a small enum; a single project can only sit in one
 *  bucket. Monorepos are flagged separately and don't currently change
 *  signal applicability (revisit if it matters). */
export type ProjectType =
  | 'library' //  npm/cargo/pypi package consumed by others
  | 'cli' //      binary / command-line tool
  | 'frontend' // static SPA, no server (Vite/Webpack/Parcel SPA)
  | 'server' //   long-running service, often containerised
  | 'docs' //     pure docs site (Docusaurus, mkdocs, Hugo content)
  | 'unknown';

interface ProjectTypeResult {
  type: ProjectType;
  /** Free-form for diagnostics / N/A reasoning. */
  signal: string;
}

// Node packages whose presence strongly implies a long-running server.
const SERVER_DEPS = new Set([
  'express',
  'fastify',
  'koa',
  '@hapi/hapi',
  'restify',
  '@nestjs/core',
  'apollo-server',
  '@apollo/server',
  'hono',
]);

// Node packages whose presence implies a browser-rendered app.
const FRONTEND_DEPS = new Set([
  'react',
  'vue',
  'svelte',
  'solid-js',
  'preact',
  '@angular/core',
  'lit',
]);

// Docs frameworks — site-style projects that don't need most app-y signals.
const DOCS_DEPS = new Set([
  '@docusaurus/core',
  '@docusaurus/preset-classic',
  'vitepress',
  'astro', // sometimes app, sometimes docs — bias docs since SSG is the default
  'mkdocs',
  'hugo',
]);

export function detectProjectType(files: FileContent[], tree: TreeEntry[]): ProjectTypeResult {
  // ── Node / npm world ──
  const pkg = files.find((f) => f.path === 'package.json');
  if (pkg) {
    try {
      const j = JSON.parse(pkg.content) as {
        bin?: unknown;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        main?: string;
        exports?: unknown;
        module?: string;
      };
      const deps = { ...j.dependencies, ...j.devDependencies };
      const depNames = Object.keys(deps);

      if (depNames.some((d) => DOCS_DEPS.has(d))) {
        return { type: 'docs', signal: 'package.json has docs framework' };
      }
      if (depNames.some((d) => SERVER_DEPS.has(d))) {
        return { type: 'server', signal: 'package.json has server framework' };
      }
      if (j.bin) {
        return { type: 'cli', signal: 'package.json has bin entry' };
      }
      if (depNames.some((d) => FRONTEND_DEPS.has(d))) {
        return { type: 'frontend', signal: 'package.json has frontend framework' };
      }
      if (j.main || j.exports || j.module) {
        return { type: 'library', signal: 'package.json has main/exports/module' };
      }
    } catch {
      // malformed package.json — fall through to other detectors
    }
  }

  // ── Rust ──
  const cargo = files.find((f) => f.path === 'Cargo.toml');
  if (cargo) {
    if (/\[\[bin\]\]/.test(cargo.content)) {
      return { type: 'cli', signal: 'Cargo.toml has [[bin]]' };
    }
    if (/\[lib\]/.test(cargo.content)) {
      return { type: 'library', signal: 'Cargo.toml has [lib]' };
    }
  }

  // ── Python ──
  const pyproject = files.find((f) => f.path === 'pyproject.toml');
  if (pyproject) {
    if (/\[project\.scripts\]|\[tool\.poetry\.scripts\]/.test(pyproject.content)) {
      return { type: 'cli', signal: 'pyproject.toml has project.scripts' };
    }
    // setup.py / pyproject.toml with a name = likely library
    return { type: 'library', signal: 'pyproject.toml present (library default)' };
  }

  // ── Go ──
  const goMod = files.find((f) => f.path === 'go.mod');
  if (goMod) {
    const hasMainGo = tree.some((e) => e.type === 'blob' && e.path === 'main.go');
    return hasMainGo
      ? { type: 'cli', signal: 'go.mod + main.go' }
      : { type: 'library', signal: 'go.mod without main.go' };
  }

  // ── Containerisation as a last-resort server hint ──
  const hasDockerfile = tree.some(
    (e) => e.type === 'blob' && (e.path === 'Dockerfile' || e.path.endsWith('/Dockerfile')),
  );
  if (hasDockerfile) {
    return { type: 'server', signal: 'Has Dockerfile' };
  }

  return { type: 'unknown', signal: 'no strong type signals' };
}

/** Human-readable reason for `notApplicable` on a signal, based on type. */
export function naReasonFor(type: ProjectType, signal: string): string {
  const noun = type === 'unknown' ? 'this project' : type;
  return `Not applicable for ${noun}: ${signal}`;
}

/** Tree-only classifier used by the light engine (no file contents).
 *  Weaker than the full detector — only fires when the tree itself
 *  strongly implies a type. Defaults to `unknown` so signals stay
 *  applicable when in doubt. */
export function detectProjectTypeLight(
  treePaths: Set<string>,
  tree: TreeEntry[],
): ProjectTypeResult {
  const hasDockerfile = tree.some(
    (e) => e.type === 'blob' && (e.path === 'Dockerfile' || e.path.endsWith('/Dockerfile')),
  );
  if (hasDockerfile) return { type: 'server', signal: 'Has Dockerfile' };

  if (treePaths.has('main.go')) return { type: 'cli', signal: 'main.go at root' };
  if (treePaths.has('src/main.rs')) return { type: 'cli', signal: 'src/main.rs (Rust binary)' };

  const hasSpaConfig =
    treePaths.has('vite.config.ts') ||
    treePaths.has('vite.config.js') ||
    treePaths.has('webpack.config.js') ||
    treePaths.has('rollup.config.js') ||
    treePaths.has('parcel.config.js');
  const hasIndexHtml = treePaths.has('index.html');
  if (hasSpaConfig && hasIndexHtml) {
    return { type: 'frontend', signal: 'SPA build config + index.html' };
  }

  // package.json without server/CLI signals & no Dockerfile — likely a
  // library or frontend, but we can't tell which from tree alone. Stay
  // conservative: `unknown` keeps all signals applicable.
  return { type: 'unknown', signal: 'no strong tree-only signals' };
}

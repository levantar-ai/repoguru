/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const isomorphicGitEsm = fileURLToPath(
  new URL('./node_modules/isomorphic-git/index.js', import.meta.url),
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  plugins: [react(), tailwindcss()],
  // isomorphic-git's `exports."."` only has a `default` pointing at the CJS
  // index, which `require('crypto')`s Node. Alias the bare specifier at its
  // ESM `index.js` (browser-safe — uses `crypto.subtle` only), and force the
  // dep optimizer to pre-bundle that ESM entry so its CJS transitive deps
  // (async-lock, pako, pify, …) still get the CJS→ESM shim. The regex match
  // is exact so subpath imports like `isomorphic-git/http/web` aren't
  // affected.
  resolve: {
    alias: [
      {
        find: /^isomorphic-git$/,
        replacement: isomorphicGitEsm,
      },
    ],
  },
  optimizeDeps: {
    include: [
      'buffer',
      '@isomorphic-git/lightning-fs',
      'isomorphic-git/http/web',
      // Force pre-bundling of the ESM entry by absolute path so its CJS
      // transitive deps (async-lock, pako, …) get the CJS→ESM shim.
      isomorphicGitEsm,
    ],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.stories.tsx',
        'src/stories/**',
        'src/test/**',
        'src/**/*.d.ts',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        statements: 35,
        branches: 32,
        functions: 26,
        lines: 35,
      },
    },
  },
});

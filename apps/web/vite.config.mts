/// <reference types='vitest' />

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

function requireApiUrl(env: Record<string, string>): Plugin {
  return {
    name: 'require-api-url',
    apply: 'build',
    buildStart() {
      if (!env.VITE_API_URL) {
        throw new Error(
          'VITE_API_URL must be set to build the web app (see apps/web/.env.example)',
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');

  return {
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/web',
    server: {
      port: 4200,
      host: 'localhost',
    },
    preview: {
      port: 4200,
      host: 'localhost',
    },
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tanstackRouter({
        routesDirectory: './src/app/routes',
        generatedRouteTree: './src/app/route-tree.gen.ts',
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
      requireApiUrl(env),
    ],
    // Uncomment this if you are using workers.
    // worker: {
    //   plugins: () => [ nxViteTsPaths() ],
    // },
    build: {
      outDir: '../../dist/apps/web',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    test: {
      watch: false,
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      setupFiles: ['./src/testing/test-setup.ts'],
      reporters: ['default'],
      coverage: {
        reportsDirectory: '../../coverage/apps/web',
        provider: 'v8' as const,
      },
    },
  };
});

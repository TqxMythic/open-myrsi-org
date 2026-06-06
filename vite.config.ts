import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      coverage: {
        // Regression floor scoped to the server/business-logic surface (lib +
        // api); the untested UI is excluded so the gate isn't dominated by
        // component churn. `all: true` counts untested files so the baseline is
        // honest. Thresholds sit just under the measured baseline — ratchet up
        // as coverage grows, never down.
        provider: 'v8',
        all: true,
        include: ['lib/**', 'api/**'],
        exclude: ['**/*.d.ts'],
        reporter: ['text-summary'],
        thresholds: {
          lines: 5,
          statements: 5,
          functions: 3,
          branches: 3,
        },
      },
    },
    build: {
      rolldownOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('livekit')) return 'vendor-livekit';
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('@google') || id.includes('genai')) return 'vendor-genai';
              return 'vendor';
            }
            // Bundle the supabaseClient wrapper into the @supabase vendor chunk
            // rather than a standalone chunk, which Cloudflare's edge
            // optimization fails to proxy (returns 522 instead of the file).
            if (id.includes('lib/supabaseClient')) return 'vendor-supabase';
          }
        }
      },
      chunkSizeWarningLimit: 1000
    }
  };
});

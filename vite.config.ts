import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  build: {
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
}));

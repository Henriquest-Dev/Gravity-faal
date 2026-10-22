import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the build works from file:// and inside the Capacitor WebView
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});

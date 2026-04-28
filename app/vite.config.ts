import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/app/',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Manual vendor chunks — keep React core in its own cacheable chunk,
        // isolate Supabase auth/realtime, and let @google/genai naturally
        // split out via the dynamic import in geminiService.
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Inline assets <4kB to skip extra HTTP requests.
    assetsInlineLimit: 4096,
    // Better cache hits with deterministic chunk names.
    chunkSizeWarningLimit: 400,
  },
});

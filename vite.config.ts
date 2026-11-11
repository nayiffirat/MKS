import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: './',
    optimizeDeps: {
      entries: ['index.html']
    },
    server: {
      watch: {
        ignored: ['**/android/**', '**/ios/**', '**/dist/**', '**/*.apk', '**/*.aab', '**/*.exe']
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
            pdf: ['jspdf', 'jspdf-autotable', 'html2canvas'],
            icons: ['lucide-react']
          }
        }
      }
    }
  };
});

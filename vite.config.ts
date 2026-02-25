
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Bu satır APK'nın beyaz ekran vermemesi için kritik:
  base: './', 
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'firebase/app'],
          genai: ['@google/genai']
        }
      }
    }
  },
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "AIzaSyAvQQQmN-VpuhYKdz2fHFgGCpmDw58pnJg")
  }
});

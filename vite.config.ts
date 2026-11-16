import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Split rarely-changing libraries into their own chunks so app updates don't re-download them.
// three.js alone is ~700 kB minified, hence the raised warning limit.
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/three\//.test(id)) return 'three';
          if (/node_modules\/(@react-three|three-stdlib|maath|camera-controls|troika|meshline|zustand|its-fine|suspend-react)/.test(id)) return 'r3f';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
});

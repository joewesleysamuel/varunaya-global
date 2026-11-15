import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    // three.js is lazy-loaded into its own chunk; it is large by nature.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/build')) return 'three';
          if (id.includes('node_modules/gsap') || id.includes('node_modules/lenis')) return 'motion';
          return undefined;
        },
      },
    },
  },
});

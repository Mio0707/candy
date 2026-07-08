import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        'model-stage': 'model-stage/index.html',
      },
    },
  },
});

import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], post: ['postprocessing'], anim: ['gsap', 'lenis'] },
      },
    },
  },
  server: { port: 5173 },
});

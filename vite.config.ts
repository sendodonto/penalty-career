import { defineConfig } from 'vite';

// O Phaser sozinho passa de 1 MB minificado; não há o que dividir num protótipo de uma página.
// base relativa: o mesmo build funciona na raiz local e em usuario.github.io/penalty-career/.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 1600 } });

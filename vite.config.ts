import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	base: '/',
	esbuild: {
		legalComments: 'none',
	},
	build: {
		sourcemap: false,
		minify: 'esbuild',
	},
});

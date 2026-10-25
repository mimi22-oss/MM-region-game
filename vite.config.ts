import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore
import fs from 'node:fs';

/**
 * PHP ၏ filemtime ကဲ့သို့ build-time တွင် ogp.png နှင့် favicon တို့၏ mtime ကို
 * static HTML ထဲသို့ ?v=YYYYMMDDHHmmss အဖြစ် အလိုအလျောက် inject ပေးသော plugin
 */
function assetVersionPlugin(): Plugin {
	return {
		name: 'asset-auto-version',
		transformIndexHtml(html) {
			const getMtime = (filePath: string): string => {
				if (fs.existsSync(filePath)) {
					const date = new Date(fs.statSync(filePath).mtimeMs);
					const pad = (n: number) => String(n).padStart(2, '0');
					return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
				}
				return String(Date.now());
			};

			const ogpVer = getMtime('public/ogp.png');
			const favVer = getMtime('public/favicon.ico');

			return html
				.replace(
					/https:\/\/mm-region-game\.vercel\.app\/ogp\.png(\?v=[a-zA-Z0-9_-]+)?/g,
					`https://mm-region-game.vercel.app/ogp.png?v=${ogpVer}`
				)
				.replace(
					/\/favicon\.(ico|png|jpg)(\?v=[a-zA-Z0-9_-]+)?/g,
					`/favicon.$1?v=${favVer}`
				);
		},
	};
}

export default defineConfig({
	plugins: [react(), assetVersionPlugin()],
	base: '/',
	esbuild: {
		legalComments: 'none',
	},
	build: {
		rollupOptions: { input: { main: 'index.html', candles: 'candle-preview.html' } },
		sourcemap: false,
		minify: 'esbuild',
	},
});

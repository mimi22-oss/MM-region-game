import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

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

function mapRouteSpaPlugin(): Plugin {
	const handleOtaJsonRequest = (
		req: { url?: string },
		res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (body: string) => void },
	): boolean => {
		if (!req.url) return false;
		const [pathname] = req.url.split('?');
		if (!pathname.startsWith('/ota/')) return false;

		const safeName = path.basename(pathname);
		const candidates = [
			path.resolve(process.cwd(), 'dist', 'ota', safeName),
			path.resolve(process.cwd(), 'ota-artifacts', safeName),
		];
		for (const candidate of candidates) {
			if (safeName && candidate.endsWith('.json') && fs.existsSync(candidate)) {
				res.statusCode = 200;
				res.setHeader('Content-Type', 'application/json; charset=utf-8');
				res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
				res.end(fs.readFileSync(candidate, 'utf8'));
				return true;
			}
		}

		res.statusCode = 404;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
		res.end(JSON.stringify({ error: 'OTA metadata not found locally', path: pathname }));
		return true;
	};
	const rewriteMapRoute = (req: { url?: string }) => {
		if (!req.url) return;
		const [pathname, search = ''] = req.url.split('?');
		if (pathname === '/map' || pathname === '/map/') {
			req.url = `/index.html${search ? `?${search}` : ''}`;
		}
	};
	return {
		name: 'map-route-spa-fallback',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (handleOtaJsonRequest(req, res)) return;
				rewriteMapRoute(req);
				next();
			});
		},
		configurePreviewServer(server) {
			server.middlewares.use((req, res, next) => {
				if (handleOtaJsonRequest(req, res)) return;
				rewriteMapRoute(req);
				next();
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), assetVersionPlugin(), mapRouteSpaPlugin()],
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

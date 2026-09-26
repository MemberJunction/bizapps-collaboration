import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mockupDir = join(here, '../../docs/ux/mockup');
const distDir = join(here, 'dist');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.map': 'application/json; charset=utf-8',
};

export function startGalleryServer(port = 4250) {
    const server = createServer((req, res) => {
        try {
            const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
            const pathname = reqUrl.pathname;
            const theme = reqUrl.searchParams.get('theme') === 'dark' ? 'dark' : 'light';

            // Serve Angular app bundle
            if (pathname === '/app.bundle.js') {
                const bundlePath = join(distDir, 'app.bundle.js');
                if (existsSync(bundlePath)) {
                    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
                    res.end(readFileSync(bundlePath));
                    return;
                }
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('app.bundle.js not found. Run pnpm --filter @mj-biz-apps/collaboration-ux-gallery run build');
                return;
            }

            if (pathname === '/app.bundle.js.map') {
                const mapPath = join(distDir, 'app.bundle.js.map');
                if (existsSync(mapPath)) {
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(readFileSync(mapPath));
                    return;
                }
            }

            // Handle frame routes: /frame/01, /frame/02, etc. -> Return Angular shell
            const frameMatch = pathname.match(/^\/frame\/(\d{2})$/);
            if (frameMatch) {
                const frameId = frameMatch[1];
                const html = `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <base href="/">
  <title>Collaboration UX Gallery — Frame ${frameId}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
  <link rel="stylesheet" href="/base.css">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 1440px;
      height: 900px;
      overflow: hidden;
      font-family: var(--mj-font-family, 'Inter', sans-serif);
      background: var(--mj-bg-surface, #ffffff);
      color: var(--mj-text-primary, #0f172a);
    }
  </style>
</head>
<body>
  <gallery-root></gallery-root>
  <script type="module" src="/app.bundle.js"></script>
</body>
</html>`;
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
            }

            // Static files: /base.css
            if (pathname === '/base.css') {
                const cssPath = join(mockupDir, 'base.css');
                if (existsSync(cssPath)) {
                    const content = readFileSync(cssPath, 'utf8');
                    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
                    res.end(content);
                    return;
                }
            }

            // Static assets: /assets/*
            if (pathname.startsWith('/assets/')) {
                const assetPath = join(mockupDir, pathname);
                if (existsSync(assetPath) && statSync(assetPath).isFile()) {
                    const ext = extname(assetPath).toLowerCase();
                    const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
                    res.writeHead(200, { 'Content-Type': mime });
                    res.end(readFileSync(assetPath));
                    return;
                }
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Internal Error: ${err instanceof Error ? err.message : String(err)}`);
        }
    });

    server.listen(port, () => {
        console.log(`UXGallery server listening on http://localhost:${port}`);
    });

    return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const port = Number(process.env.GALLERY_PORT ?? '4250');
    startGalleryServer(port);
}

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, 'dist');
const assetsDir = join(here, 'src/assets');

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

            // Serve Gallery Index
            if (pathname === '/' || pathname === '/index.html') {
                const html = `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <title>MemberJunction Collaboration — UX Gallery</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
  <link rel="stylesheet" href="/gallery.css">
  <style>
    body { margin: 0; padding: 40px; font-family: Inter, sans-serif; background: var(--mj-bg-page, #f8fafc); color: var(--mj-text-primary, #0f172a); }
    .card { background: var(--mj-bg-surface, #fff); border: 1px solid var(--mj-border-default, #e2e8f0); border-radius: 12px; padding: 24px; max-width: 800px; margin: 0 auto; box-shadow: var(--mj-shadow-sm, 0 1px 3px rgba(0,0,0,0.05)); }
    h1 { font-size: 24px; margin-top: 0; margin-bottom: 8px; }
    p { color: var(--mj-text-secondary, #475569); line-height: 1.5; margin-bottom: 24px; }
    .grid { display: flex; flex-direction: column; gap: 12px; }
    .row { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border: 1px solid var(--mj-border-default, #e2e8f0); border-radius: 8px; background: var(--mj-bg-surface, #fff); text-decoration: none; color: inherit; transition: all 0.15s ease; }
    .row:hover { border-color: var(--mj-brand-primary, #0076b6); background: var(--mj-bg-surface-hover, #f1f5f9); }
    .links { display: flex; gap: 12px; }
    .btn-link { font-size: 13.5px; font-weight: 600; color: var(--mj-brand-primary, #0076b6); text-decoration: none; padding: 4px 8px; border-radius: 6px; }
    .btn-link:hover { background: color-mix(in srgb, var(--mj-brand-primary, #0076b6) 10%, transparent); text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>MemberJunction Collaboration — UX Gallery (Slice A)</h1>
    <p>Live smoke test harness for Angular L1/L2 components rendered at full 1440×900 resolution with MemberJunction design tokens.</p>
    <div class="grid">
      <div class="row">
        <div>
          <div style="font-weight: 700; font-size: 15px;">Frame 02 — Space Overview (Discovery)</div>
          <div style="font-size: 13px; color: var(--mj-text-secondary, #64748b); margin-top: 4px;">Attentional needs-you strip, shared deliverables, team working set, ask box, and room preview</div>
        </div>
        <div class="links">
          <a class="btn-link" href="/frame/02" target="_blank"><i class="fa-solid fa-sun"></i> Light</a>
          <a class="btn-link" href="/frame/02?theme=dark" target="_blank"><i class="fa-solid fa-moon"></i> Dark</a>
        </div>
      </div>
      <div class="row">
        <div>
          <div style="font-weight: 700; font-size: 15px;">Frame 03 — Space Library</div>
          <div style="font-size: 13px; color: var(--mj-text-secondary, #64748b); margin-top: 4px;">Collection sidebar, smart views, file table with citation metrics, and document preview drawer</div>
        </div>
        <div class="links">
          <a class="btn-link" href="/frame/03" target="_blank"><i class="fa-solid fa-sun"></i> Light</a>
          <a class="btn-link" href="/frame/03?theme=dark" target="_blank"><i class="fa-solid fa-moon"></i> Dark</a>
        </div>
      </div>
      <div class="row">
        <div>
          <div style="font-weight: 700; font-size: 15px;">Frame 04 — Share Check Dialog</div>
          <div style="font-size: 13px; color: var(--mj-text-secondary, #64748b); margin-top: 4px;">Promotion modal overlay, audience grid, PII check findings, note, effects, and actions</div>
        </div>
        <div class="links">
          <a class="btn-link" href="/frame/04" target="_blank"><i class="fa-solid fa-sun"></i> Light</a>
          <a class="btn-link" href="/frame/04?theme=dark" target="_blank"><i class="fa-solid fa-moon"></i> Dark</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
                return;
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
  <link rel="stylesheet" href="/gallery.css">
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

            // Static gallery stylesheet: /gallery.css (or legacy /base.css)
            if (pathname === '/gallery.css' || pathname === '/base.css') {
                const cssPath = join(distDir, 'gallery.css');
                if (existsSync(cssPath)) {
                    const content = readFileSync(cssPath, 'utf8');
                    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
                    res.end(content);
                    return;
                }
            }

            // Static gallery assets: /assets/*
            if (pathname.startsWith('/assets/')) {
                const relPath = pathname.replace(/^\/assets\//, '');
                const assetPath = join(assetsDir, relPath);
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

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mockupDir = join(here, '../../docs/ux/mockup');
const htmlDir = join(mockupDir, 'html');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
};

const FRAME_MAP = {
    '01': '01-home.html',
    '02': '02-space-overview.html',
    '03': '03-library.html',
    '04': '04-share-check.html',
    '05': '05-chat-room.html',
    '06': '06-people-access.html',
    '07': '07-client-home.html',
    '08': '08-committee-member.html',
    '09': '09-assistant-settings.html',
    '10': '10-work-board.html',
    '11': '11-chat-dark.html',
    '12': '12-mobile-client.html',
    '13': '13-new-space.html',
};

export function startGalleryServer(port = 4250) {
    const server = createServer((req, res) => {
        try {
            const reqUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
            const pathname = reqUrl.pathname;
            const theme = reqUrl.searchParams.get('theme');

            // Handle frame routes: /frame/01, /frame/02, etc.
            const frameMatch = pathname.match(/^\/frame\/(\d{2})$/);
            if (frameMatch) {
                const frameId = frameMatch[1];
                const fileName = FRAME_MAP[frameId];
                if (!fileName) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end(`Frame ${frameId} not found`);
                    return;
                }
                const filePath = join(htmlDir, fileName);
                let content = readFileSync(filePath, 'utf8');

                // Adjust data-theme if specified
                if (theme === 'dark') {
                    content = content.replace(/data-theme="[^"]*"/, 'data-theme="dark"');
                } else if (theme === 'light') {
                    content = content.replace(/data-theme="[^"]*"/, 'data-theme="light"');
                }

                // Rewrite relative base.css path if needed
                content = content.replace(/href="\.\.\/base\.css"/g, 'href="/base.css"');

                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
                return;
            }

            // Static files: /base.css
            if (pathname === '/base.css') {
                const cssPath = join(mockupDir, 'base.css');
                const content = readFileSync(cssPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
                res.end(content);
                return;
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

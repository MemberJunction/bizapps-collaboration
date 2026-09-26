import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export async function bundleGalleryApp() {
    await build({
        entryPoints: [join(here, 'dist/main.js')],
        bundle: true,
        outfile: join(here, 'dist/app.bundle.js'),
        format: 'esm',
        target: 'es2022',
        sourcemap: true,
        define: {
            'ngDevMode': 'false',
        },
    });
    console.log('UXGallery app bundled to dist/app.bundle.js');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    await bundleGalleryApp();
}

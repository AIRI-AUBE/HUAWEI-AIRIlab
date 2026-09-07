import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const mimeTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.gif', 'image/gif'],
    ['.html', 'text/html; charset=utf-8'],
    ['.ico', 'image/x-icon'],
    ['.jpeg', 'image/jpeg'],
    ['.jpg', 'image/jpeg'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.map', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.webp', 'image/webp'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2'],
]);

const isInside = (rootDir, candidate) => {
    const pathFromRoot = relative(rootDir, candidate);
    return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..');
};

const sendFile = async (request, response, filePath) => {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error('Not a file');

    response.writeHead(200, {
        'Content-Length': file.size,
        'Content-Type': mimeTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
        response.end();
        return;
    }
    createReadStream(filePath).pipe(response);
};

export const startDisplayServer = async ({
    rootDir,
    host = '127.0.0.1',
    port = 3000,
}) => {
    const siteRoot = resolve(rootDir);
    const indexPath = join(siteRoot, 'index.html');
    const server = createServer(async (request, response) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            response.writeHead(405, { Allow: 'GET, HEAD' });
            response.end('Method not allowed');
            return;
        }

        try {
            const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
            const requestedPath = resolve(siteRoot, `.${pathname}`);
            if (!isInside(siteRoot, requestedPath)) {
                response.writeHead(403);
                response.end('Forbidden');
                return;
            }

            try {
                await sendFile(request, response, pathname === '/' ? indexPath : requestedPath);
            } catch {
                if (extname(pathname)) {
                    response.writeHead(404);
                    response.end('Not found');
                    return;
                }
                await sendFile(request, response, indexPath);
            }
        } catch (error) {
            response.writeHead(500);
            response.end('The display server could not load this file.');
            console.error(error);
        }
    });

    await new Promise((resolveListen, rejectListen) => {
        server.once('error', rejectListen);
        server.listen(port, host, () => {
            server.off('error', rejectListen);
            resolveListen();
        });
    });
    return server;
};

const scriptPath = fileURLToPath(import.meta.url);
const launchedDirectly = process.argv[1] && resolve(process.argv[1]) === scriptPath;

if (launchedDirectly) {
    const rootDir = resolve(dirname(scriptPath), 'dist');
    const server = await startDisplayServer({ rootDir });
    console.log('AIRI Display is running at http://localhost:3000');
    console.log('Keep this window open. Press Ctrl+C to stop.');

    const stop = () => server.close(() => process.exit(0));
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}

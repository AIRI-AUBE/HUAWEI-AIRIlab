import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { startDisplayServer } from '../scripts/display-server.mjs';

test('serves the built index and falls back to it for client-side routes', async (t) => {
    const rootDir = await mkdtemp(join(tmpdir(), 'airi-display-'));
    await writeFile(join(rootDir, 'index.html'), '<h1>AIRI display</h1>');

    const server = await startDisplayServer({
        rootDir,
        host: '127.0.0.1',
        port: 0,
    });
    t.after(async () => {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
        );
        await rm(rootDir, { recursive: true, force: true });
    });

    const address = server.address();
    assert(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;

    const home = await fetch(`${origin}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type') ?? '', /^text\/html/);
    assert.equal(await home.text(), '<h1>AIRI display</h1>');

    const clientRoute = await fetch(`${origin}/stdio/sign-in`);
    assert.equal(clientRoute.status, 200);
    assert.equal(await clientRoute.text(), '<h1>AIRI display</h1>');
});

test('exposes an AIRI-specific health response for launcher ownership checks', async (t) => {
    const rootDir = await mkdtemp(join(tmpdir(), 'airi-display-'));
    await writeFile(join(rootDir, 'index.html'), '<h1>AIRI display</h1>');

    const server = await startDisplayServer({
        rootDir,
        host: '127.0.0.1',
        port: 0,
    });
    t.after(async () => {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
        );
        await rm(rootDir, { recursive: true, force: true });
    });

    const address = server.address();
    assert(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/__airi_display_health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await response.json(), {
        service: 'airi-display',
        status: 'ok',
    });
});

test('does not serve files reached through a link outside the site root', async (t) => {
    const rootDir = await mkdtemp(join(tmpdir(), 'airi-display-'));
    const outsideDir = await mkdtemp(join(tmpdir(), 'airi-display-private-'));
    await writeFile(join(rootDir, 'index.html'), '<h1>AIRI display</h1>');
    await writeFile(join(outsideDir, 'secret.txt'), 'must not be served');
    await symlink(
        outsideDir,
        join(rootDir, 'escape'),
        process.platform === 'win32' ? 'junction' : 'dir',
    );

    const server = await startDisplayServer({
        rootDir,
        host: '127.0.0.1',
        port: 0,
    });
    t.after(async () => {
        await new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
        );
        await rm(rootDir, { recursive: true, force: true });
        await rm(outsideDir, { recursive: true, force: true });
    });

    const address = server.address();
    assert(address && typeof address === 'object');
    const response = await fetch(`http://127.0.0.1:${address.port}/escape/secret.txt`);

    assert.equal(response.status, 403);
    assert.equal(await response.text(), 'Forbidden');
});

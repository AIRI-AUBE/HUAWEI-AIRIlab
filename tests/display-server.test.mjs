import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

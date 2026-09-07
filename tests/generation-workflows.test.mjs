import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let server;

before(async () => {
    server = await createServer({
        root: process.cwd(),
        configFile: false,
        appType: 'custom',
        logLevel: 'error',
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true },
    });
});

after(async () => {
    await server?.close();
});

test('text-to-image emits the workflow 44 contract without image inputs', async () => {
    const { mapTextToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/textToImage.ts',
    );

    const payload = mapTextToImagePayload({
        prompt: 'A timber library',
        projectId: 101,
        teamId: 202,
    });

    assert.deepEqual(payload, {
        workflowId: '44',
        workflowVersion: 'V3',
        projectId: 101,
        teamId: 202,
        prompt: 'A timber library',
        aspectRatio: '16:9',
        orientation: 0,
        imageRatio: 3,
        referenceImage: [],
        language: 'chs',
    });
    assert.equal('baseImage' in payload, false);
    assert.equal('model' in payload, false);
});

test('image-to-image emits workflow 39 with uploaded images and no prompt', async () => {
    const { mapImageToImagePayload } = await server.ssrLoadModule(
        '/src/features/generation/imageToImage.ts',
    );

    const payload = mapImageToImagePayload({
        baseImage: { url: 'https://example.test/base.webp' },
        imageType: 'architecture',
        referenceImages: [
            {
                url: 'https://example.test/reference.webp',
                tags: ['facade-design'],
            },
        ],
        projectId: 101,
        projectName: 'Regression test',
        teamId: 202,
        language: 'en',
    });

    assert.equal(payload.workflowId, 39);
    assert.equal(payload.workflowVersion, 'V3');
    assert.equal(payload.model, 39);
    assert.equal(payload.baseImage, 'https://example.test/base.webp');
    assert.deepEqual(payload.referenceImage, [
        {
            url: 'https://example.test/reference.webp',
            weight: 0,
            categories: ['facade_or_interface'],
        },
    ]);
    assert.equal(payload.enteredText, '');
    assert.equal(payload.prompt, '');
    assert.equal('aspectRatio' in payload, false);
});

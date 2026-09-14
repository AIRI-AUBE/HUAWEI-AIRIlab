import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const matrix = JSON.parse(
    readFileSync(new URL('./fixtures/speech/languages.json', import.meta.url), 'utf8'),
);
let server, browser, origin;
before(async () => {
    // Never send local credentials or generation requests to external services in this suite.
    Object.assign(process.env, {
        VITE_AIRI_API_BASE_URL: '',
        VITE_AIRI_AUTH_TOKEN: '',
        VITE_AIRI_API_KEY: '',
        VITE_SPEECH_API_URL: '',
        VITE_AIRI_PROJECT_ID: '1',
        VITE_AIRI_TEAM_ID: '0',
    });
    server = await createServer({
        server: { host: '127.0.0.1', port: 0, open: false },
        logLevel: 'error',
    });
    await server.listen();
    origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    const executablePath =
        process.env.BROWSER_EXECUTABLE ||
        [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome',
        ].find(existsSync);
    browser = await chromium.launch({
        executablePath,
        headless: true,
        args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
});
after(async () => {
    await browser?.close();
    await server?.close();
});

async function pageFixture(t) {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(60000);
    t.after(() => page.close());
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    t.after(() => assert.deepEqual(errors, [], 'uncaught browser errors'));
    await page.route('**/*', (route) =>
        route.request().url().startsWith(origin) ? route.continue() : route.abort(),
    );
    await page.addInitScript(() => {
        window.capture = { starts: 0, stops: 0, permission: 0 };
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
            value: async () => {
                window.capture.permission++;
                if (window.denyMicrophone) throw new DOMException('denied', 'NotAllowedError');
                return { getTracks: () => [{ stop: () => window.capture.stops++ }] };
            },
        });
        window.MediaRecorder = class {
            static isTypeSupported() {
                return true;
            }
            state = 'inactive';
            mimeType = 'audio/webm';
            start() {
                this.state = 'recording';
                window.capture.starts++;
            }
            stop() {
                this.state = 'inactive';
                queueMicrotask(() => {
                    this.ondataavailable?.({ data: new Blob(['audio'], { type: this.mimeType }) });
                    this.onstop?.();
                });
            }
        };
    });
    return page;
}

test('all 17 languages pass through microphone button and React textarea unchanged', async (t) => {
    const page = await pageFixture(t);
    let sample;
    await page.route('**/api/transcribe', async (route) => {
        assert.match(route.request().headers()['content-type'], /multipart\/form-data; boundary=/);
        assert.doesNotMatch(route.request().postData(), /name="language"|name="task"/);
        await route.fulfill({ json: sample });
    });
    await page.goto(`${origin}/text-to-image`);
    assert.equal(await page.evaluate(() => window.capture.permission), 0);
    const textarea = page.locator('textarea');
    for (sample of matrix) {
        await textarea.fill('');
        await page.getByRole('button', { name: 'Start voice input', exact: true }).click();
        await page.getByRole('button', { name: 'Stop voice input', exact: true }).click();
        await page.waitForFunction(
            (text) => document.querySelector('textarea').value === text,
            sample.text,
        );
        assert.equal(await textarea.inputValue(), sample.text);
    }
    const capture = await page.evaluate(() => window.capture);
    assert.deepEqual(capture, { starts: 17, stops: 17, permission: 17 });
    for (const [existing, transcript, start, end, expected] of [
        ['Create an image of ', 'a modern library', 19, 19, 'Create an image of a modern library'],
        ['创建一个', '现代图书馆', 4, 4, '创建一个现代图书馆'],
        ['未来の', '図書館', 3, 3, '未来の図書館'],
        ['A old library', 'modern', 2, 5, 'A modern library'],
    ]) {
        sample = { text: transcript, language: 'auto-test' };
        await textarea.fill(existing);
        await textarea.evaluate((el, range) => el.setSelectionRange(...range), [start, end]);
        await page.getByRole('button', { name: 'Start voice input', exact: true }).click();
        await page.getByRole('button', { name: 'Stop voice input', exact: true }).click();
        await page.waitForFunction(
            (text) => document.querySelector('textarea').value === text,
            expected,
        );
    }
});

test('voice errors recover, processing is visible, and navigation releases microphone', async (t) => {
    const page = await pageFixture(t);
    await page.goto(`${origin}/text-to-image`);
    await page.evaluate(() => {
        window.denyMicrophone = true;
    });
    await page.getByRole('button', { name: 'Start voice input', exact: true }).click();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /permission/);
    await page.evaluate(() => {
        window.denyMicrophone = false;
    });
    let release;
    await page.route('**/api/transcribe', async (route) => {
        await new Promise((resolve) => {
            release = resolve;
        });
        await route.fulfill({ status: 503, body: '{}' });
    });
    await page.getByRole('button', { name: 'Start voice input', exact: true }).click();
    await page.getByRole('button', { name: 'Stop voice input', exact: true }).click();
    const processing = page.getByRole('button', { name: 'Transcribing...', exact: true });
    await processing.waitFor();
    assert.equal(await processing.isDisabled(), true);
    while (!release) await new Promise((resolve) => setImmediate(resolve));
    release();
    await page.getByRole('alert').waitFor();
    assert.match(await page.getByRole('alert').innerText(), /unavailable/);
    await page.getByRole('button', { name: 'Start voice input', exact: true }).click();
    await page.locator('.nav a[href="/image-to-image"]').click();
    await page.waitForFunction(() => window.capture.stops === 2);
    assert.equal(await page.evaluate(() => window.capture.stops), 2);
});

test('native Chrome MediaRecorder captures audio, posts multipart bytes and releases tracks', async (t) => {
    const page = await browser.newPage();
    t.after(() => page.close());
    await page.addInitScript(() => {
        const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (...args) => {
            const stream = await original(...args);
            window.auditStream = stream;
            return stream;
        };
    });
    let audioBytes = 0;
    await page.route('**/api/transcribe', async (route) => {
        audioBytes = route.request().postDataBuffer().length;
        assert.match(route.request().headers()['content-type'], /multipart\/form-data/);
        await route.fulfill({ json: { text: 'Native recording fixture', language: 'en' } });
    });
    await page.goto(`${origin}/text-to-image`);
    await page.getByRole('button', { name: 'Start voice input', exact: true }).click();
    await page.waitForFunction(() => window.auditStream?.active);
    // Allow a real encoded chunk from Chrome's synthetic microphone.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await page.getByRole('button', { name: 'Stop voice input', exact: true }).click();
    await page.waitForFunction(
        () => document.querySelector('textarea').value === 'Native recording fixture',
    );
    assert.ok(audioBytes > 1000);
    assert.equal(
        await page.evaluate(() =>
            window.auditStream.getTracks().every((track) => track.readyState === 'ended'),
        ),
        true,
    );
});

test('navigation, language switch, templates, keyboard, generation payload/loading/result/errors', async (t) => {
    const page = await pageFixture(t);
    await page.goto(origin);
    await page.locator('.mode-card').first().waitFor();
    await page.locator('.nav a[href="/text-to-image"]').click();
    assert.equal(await page.locator('.generate-button').isDisabled(), true);
    await page.locator('.header > button').last().click();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'zh-CN');
    await page.locator('.header > button').last().click();
    await page.locator('.template-trigger').click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('.template-trigger').click();
    const text = await page.getByRole('option').first().innerText();
    await page.getByRole('option').first().click();
    assert.equal(await page.locator('textarea').inputValue(), text);
    let payload, complete;
    await page.route('**/api/Universal/Generate', async (route) => {
        payload = route.request().postDataJSON();
        await route.fulfill({ json: { data: { jobId: 'audit-job' } } });
    });
    await page.route('**/api/Universal/Job/audit-job', async (route) => {
        await new Promise((resolve) => {
            complete = resolve;
        });
        await route.fulfill({ json: { status: 'completed' } });
    });
    await page.route('**/api/Universal/Job/audit-job/result', (route) =>
        route.fulfill({ json: { outputs: [{ url: '/assets/figma/huawei-logo.svg' }] } }),
    );
    await page.locator('textarea').fill('创建现代图书馆');
    await page.locator('.generate-button').click();
    await page.locator('.image-skeleton').waitFor();
    assert.equal(await page.locator('.generate-button').isDisabled(), true);
    while (!complete) await new Promise((resolve) => setImmediate(resolve));
    complete();
    await page.locator('.text-generation-output').waitFor();
    assert.equal(payload.prompt, '创建现代图书馆');
    assert.equal(payload.workflowId, '44');
    assert.equal(payload.language, 'chs');
    assert.deepEqual(payload.referenceImage, []);
    await page.route('**/api/Universal/Generate', (route) =>
        route.fulfill({ status: 500, body: '{}' }),
    );
    await page.locator('.generate-button').click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('.generate-button').isEnabled(), true);
});

test('image uploads, image-to-image generation, removal keyboard and narrow layout', async (t) => {
    const page = await pageFixture(t);
    await page.goto(`${origin}/image-to-image`);
    assert.equal(await page.locator('.refinement-generate').isDisabled(), true);
    const buffer = await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 300;
        return Array.from(new Uint8Array(await (await fetch(canvas.toDataURL())).arrayBuffer()));
    });
    await page.route('**/api/GenerateWorkflow/UploadMedia', (route) =>
        route.fulfill({ json: { data: { path: '/assets/figma/huawei-logo.svg' } } }),
    );
    const file = { name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(buffer) };
    await page.locator('input[type=file]').nth(0).setInputFiles(file);
    await page.locator('.upload-preview').waitFor();
    await page.locator('input[type=file]').nth(1).setInputFiles(file);
    await page.waitForFunction(() => !document.querySelector('.refinement-generate').disabled);
    let payload;
    await page.route('**/api/Universal/Generate', (route) => {
        payload = route.request().postDataJSON();
        return route.fulfill({ json: { jobId: 'image-job' } });
    });
    await page.route('**/api/Universal/Job/image-job', (route) =>
        route.fulfill({ json: { status: 'completed' } }),
    );
    await page.route('**/api/Universal/Job/image-job/result', (route) =>
        route.fulfill({ json: { outputs: [{ url: '/assets/figma/huawei-logo.svg' }] } }),
    );
    await page.locator('textarea').fill('नया पुस्तकालय');
    await page.locator('.refinement-generate').click();
    await page.locator('.generation-preview--result').waitFor();
    assert.equal(payload.workflowId, 39);
    assert.equal(payload.prompt, 'नया पुस्तकालय');
    assert.equal(payload.enteredText, payload.prompt);
    assert.equal(payload.additionalPrompt, payload.prompt);
    await page.locator('.upload-preview__remove').last().focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.upload-preview').count(), 1);
    await page.setViewportSize({ width: 390, height: 700 });
    await page.locator('.refinement-template').click();
    const popup = await page.getByRole('dialog').boundingBox();
    assert.ok(popup.x >= 0 && popup.x + popup.width <= 390);
    assert.ok(popup.y >= 0 && popup.y + popup.height <= 700);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('.nav a[href="/text-to-image"]').click();
    for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            true,
            `overflow at ${width}`,
        );
        const mic = await page.locator('.voice-control button').boundingBox();
        const field = await page.locator('.prompt-field').boundingBox();
        assert.ok(
            mic.x + mic.width <= field.x + 1 || mic.y + mic.height <= field.y + 1,
            `microphone overlap at ${width}`,
        );
    }
});

test('saved language and blocked storage load safely; unsupported recording is disabled', async (t) => {
    const page = await pageFixture(t);
    await page.addInitScript(() => localStorage.setItem('airi-language', 'chs'));
    await page.goto(`${origin}/text-to-image`);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'zh-CN');
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
            get() {
                throw new DOMException('blocked', 'SecurityError');
            },
        });
        window.MediaRecorder = undefined;
    });
    // The previous init script intentionally accesses storage, so use a fresh page.
    const blocked = await browser.newPage();
    t.after(() => blocked.close());
    const errors = [];
    blocked.on('pageerror', (error) => errors.push(error.message));
    await blocked.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
            get() {
                throw new DOMException('blocked', 'SecurityError');
            },
        });
        window.MediaRecorder = undefined;
    });
    await blocked.goto(`${origin}/text-to-image`);
    await blocked.locator('textarea').waitFor();
    assert.equal(await blocked.locator('.voice-control button').isDisabled(), true);
    await blocked.locator('.header > button').last().click();
    assert.equal(await blocked.evaluate(() => document.documentElement.lang), 'zh-CN');
    assert.deepEqual(errors, []);
});

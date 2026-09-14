import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

const languages = JSON.parse(
    readFileSync(new URL('./fixtures/speech/languages.json', import.meta.url), 'utf8'),
);

let server;
let speech;
let voice;
before(async () => {
    server = await createServer({
        configFile: false,
        appType: 'custom',
        logLevel: 'error',
        optimizeDeps: { noDiscovery: true },
        server: { middlewareMode: true, hmr: false, ws: false },
    });
    speech = await server.ssrLoadModule('/src/features/speech/insertSpeech.ts');
    voice = await server.ssrLoadModule('/src/features/speech/voiceInput.ts');
});

function fixture(overrides = {}) {
    const states = [],
        texts = [],
        recordings = [];
    let stopped = 0,
        acquired = 0;
    const stream = { getTracks: () => [{ stop: () => stopped++ }] };
    const controller = voice.createVoiceInputController(
        (state) => states.push(state),
        (text) => texts.push(text),
        {
            getUserMedia: async () => {
                acquired++;
                return stream;
            },
            createRecorder: () => {
                const recorder = {
                    state: 'inactive',
                    mimeType: 'audio/webm',
                    start() {
                        this.state = 'recording';
                    },
                    stop() {
                        this.state = 'inactive';
                        queueMicrotask(() => {
                            this.ondataavailable?.({ data: new Blob(['audio']) });
                            this.onstop?.();
                        });
                    },
                };
                recordings.push(recorder);
                return recorder;
            },
            transcribe: async () => ({ text: '创建一个现代图书馆', language: 'zh' }),
            ...overrides,
        },
    );
    return {
        controller,
        states,
        texts,
        recordings,
        stream,
        stopped: () => stopped,
        acquired: () => acquired,
    };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

for (const { name, text, language } of languages) {
    test(`${name}: multipart response, recording state and insertion preserve exact text/language`, async (t) => {
        t.mock.method(globalThis, 'fetch', async (_url, init) => {
            assert.equal(init.method, 'POST');
            assert.equal(init.headers, undefined);
            assert.deepEqual([...init.body.keys()], ['audio']);
            assert.equal(await init.body.get('audio').text(), 'audio');
            return Response.json({ text, language });
        });
        const f = fixture({ transcribe: voice.transcribeAudio });
        t.after(() => f.controller.dispose());
        assert.equal(f.acquired(), 0);
        assert.deepEqual(voice.initialVoiceState, {
            isListening: false,
            isTranscribing: false,
            transcript: '',
            detectedLanguage: null,
            error: null,
        });
        await f.controller.start();
        assert.equal(f.states.at(-1).isListening, true);
        f.controller.stop();
        assert.equal(f.states.at(-1).isTranscribing, true);
        await settle();
        assert.deepEqual(f.texts, [text]);
        assert.equal(f.states.at(-1).detectedLanguage, language);
        assert.equal(speech.insertSpeech('', text, 0).text, text);
    });
}

test('duplicate stop events cannot create duplicate uploads or transcripts', async (t) => {
    let resolve,
        uploads = 0;
    const f = fixture({
        transcribe: () => {
            uploads++;
            return new Promise((done) => {
                resolve = done;
            });
        },
    });
    t.after(() => f.controller.dispose());
    await f.controller.start();
    const onstop = f.recordings[0].onstop;
    f.controller.stop();
    f.controller.stop();
    await settle();
    void onstop();
    assert.equal(uploads, 1);
    resolve({ text: 'library', language: 'en' });
    await settle();
    assert.deepEqual(f.texts, ['library']);
});

test('malformed API responses, size limit and exact whitespace preservation', async (t) => {
    const blob = new Blob(['audio'], { type: 'audio/mp4' });
    const signal = new AbortController().signal;
    for (const body of [
        null,
        [],
        {},
        { text: 42, language: 'en' },
        { text: 'hi', language: '' },
        { text: 'hi' },
    ]) {
        t.mock.method(globalThis, 'fetch', async () => Response.json(body));
        await assert.rejects(voice.transcribeAudio(blob, signal), /Unable to transcribe/);
    }
    t.mock.method(globalThis, 'fetch', async () => new Response('not json'));
    await assert.rejects(voice.transcribeAudio(blob, signal), /Unable to transcribe/);
    await assert.rejects(
        voice.transcribeAudio(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), signal),
        /too large/,
    );
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
        assert.equal(init.body.get('audio').name, 'recording.mp4');
        return Response.json({ text: '  bibliothèque  ', language: 'fr' });
    });
    assert.deepEqual(await voice.transcribeAudio(blob, signal), {
        text: '  bibliothèque  ',
        language: 'fr',
    });
});

test('timeout aborts transcription and late success cannot update state', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let signal, finish;
    const f = fixture({
        transcribe: (_audio, s) => {
            signal = s;
            return new Promise((resolve) => {
                finish = resolve;
            });
        },
    });
    t.after(() => f.controller.dispose());
    await f.controller.start();
    f.controller.stop();
    await settle();
    t.mock.timers.tick(120001);
    assert.equal(signal.aborted, true);
    assert.match(f.states.at(-1).error, /timed out/);
    finish({ text: 'late', language: 'en' });
    await settle();
    assert.deepEqual(f.texts, []);
    assert.equal(f.states.at(-1).isTranscribing, false);
});

test('stop event timeout and recording size errors release hardware', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const f = fixture();
    t.after(() => f.controller.dispose());
    await f.controller.start();
    f.recordings[0].stop = function () {
        this.state = 'inactive';
    };
    f.controller.stop();
    t.mock.timers.tick(5001);
    assert.match(f.states.at(-1).error, /finish recording/);
    await f.controller.start();
    f.recordings[1].ondataavailable({ data: new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]) });
    assert.match(f.states.at(-1).error, /too large/);
    assert.equal(f.stopped(), 2);
});

test('recorder creation failure releases the microphone', async () => {
    const f = fixture({
        createRecorder: () => {
            throw new Error('unsupported codec');
        },
    });
    await f.controller.start();
    assert.equal(f.stopped(), 1);
    assert.equal(f.states.at(-1).isListening, false);
    assert.equal(f.states.at(-1).error, 'Unable to record audio. Please try again.');
    f.controller.dispose();
});

test('an empty recording does not call the backend', async () => {
    let uploads = 0;
    const f = fixture({
        transcribe: async () => {
            uploads++;
        },
    });
    await f.controller.start();
    f.recordings[0].stop = function () {
        this.state = 'inactive';
        queueMicrotask(() => this.onstop?.());
    };
    f.controller.stop();
    await settle();
    assert.equal(uploads, 0);
    assert.match(f.states.at(-1).error, /No audio recorded/);
    assert.equal(f.stopped(), 1);
    f.controller.dispose();
});

test('record, stop, upload, and repeat preserve original script and release tracks', async () => {
    const f = fixture();
    try {
        for (let i = 0; i < 2; i++) {
            await f.controller.start();
            await f.controller.start();
            assert.equal(f.recordings.length, i + 1);
            f.controller.stop();
            assert.equal(f.stopped(), i + 1);
            await settle();
            assert.equal(f.texts[i], '创建一个现代图书馆');
            assert.equal(f.states.at(-1).detectedLanguage, 'zh');
            assert.equal(f.states.at(-1).isTranscribing, false);
        }
    } finally {
        f.controller.dispose();
    }
});

test('stop during pending permission releases any subsequently granted stream', async () => {
    let grant;
    const f = fixture({
        getUserMedia: () =>
            new Promise((resolve) => {
                grant = resolve;
            }),
    });
    const started = f.controller.start();
    f.controller.stop();
    grant(f.stream);
    await started;
    assert.equal(f.stopped(), 1);
    assert.equal(f.recordings.length, 0);
    assert.equal(f.states.at(-1).isListening, false);
    f.controller.dispose();
});

test('permission denied returns a friendly error and permits retry', async () => {
    const f = fixture({
        getUserMedia: async () => {
            throw new DOMException('denied', 'NotAllowedError');
        },
    });
    await f.controller.start();
    assert.equal(f.states.at(-1).error, 'Microphone permission is required.');
    assert.equal(f.states.at(-1).isListening, false);
    await f.controller.start();
    assert.equal(f.states.length, 4);
    f.controller.dispose();
});

test('dispose while recording stops hardware without uploading or notifying React', async () => {
    let uploads = 0;
    const f = fixture({
        transcribe: async () => {
            uploads++;
        },
    });
    await f.controller.start();
    const count = f.states.length;
    f.controller.dispose();
    await settle();
    assert.equal(f.stopped(), 1);
    assert.equal(f.recordings[0].state, 'inactive');
    assert.equal(uploads, 0);
    assert.equal(f.states.length, count);
});

test('cancel during transcription aborts upload and ignores stale results', async () => {
    let resolve, signal;
    const f = fixture({
        transcribe: (_blob, currentSignal) => {
            signal = currentSignal;
            return new Promise((done) => {
                resolve = done;
            });
        },
    });
    await f.controller.start();
    f.controller.stop();
    await settle();
    f.controller.cancel();
    assert.equal(signal.aborted, true);
    resolve({ text: 'stale', language: 'en' });
    await settle();
    assert.deepEqual(f.texts, []);
    f.controller.dispose();
});

test('backend errors return to idle after microphone release', async () => {
    const f = fixture({
        transcribe: async () => {
            throw new Error('Speech service is unavailable.');
        },
    });
    await f.controller.start();
    f.controller.stop();
    await settle();
    assert.equal(f.states.at(-1).error, 'Speech service is unavailable.');
    assert.equal(f.states.at(-1).isTranscribing, false);
    assert.equal(f.stopped(), 1);
    f.controller.dispose();
});

test('upload sends only multipart audio, preserves language, and handles failures', async () => {
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async (url, init) => {
            assert.match(url, /\/api\/transcribe$/);
            assert.deepEqual([...init.body.keys()], ['audio']);
            assert.equal(init.body.get('audio').type, 'audio/webm');
            return new Response(JSON.stringify({ text: '図書館を作る', language: 'ja' }));
        };
        const blob = new Blob(['audio'], { type: 'audio/webm' });
        const signal = new AbortController().signal;
        assert.equal((await voice.transcribeAudio(blob, signal)).text, '図書館を作る');
        for (const status of [413, 415, 422, 429, 500, 503]) {
            globalThis.fetch = async () => new Response('private server error', { status });
            await assert.rejects(
                voice.transcribeAudio(blob, signal),
                (error) => !error.message.includes('private'),
            );
        }
        globalThis.fetch = async () => {
            throw new TypeError('fetch failed');
        };
        await assert.rejects(voice.transcribeAudio(blob, signal), /Speech service is unavailable/);
        await assert.rejects(voice.transcribeAudio(new Blob([]), signal), /No audio/);
        globalThis.fetch = async () => new Response(JSON.stringify({ text: '', language: 'en' }));
        await assert.rejects(voice.transcribeAudio(blob, signal), /No speech/);
    } finally {
        globalThis.fetch = original;
    }
});
after(async () => {
    await server?.close();
});

test('speech insertion preserves existing content and replaces the selected range', () => {
    assert.deepEqual(speech.insertSpeech('Create an image of ', 'a modern library', 19), {
        text: 'Create an image of a modern library',
        cursor: 35,
    });
    assert.equal(speech.insertSpeech('A old library', 'modern', 2, 5).text, 'A modern library');
    assert.equal(speech.insertSpeech('A library', 'modern', 2).text, 'A modern library');
    assert.equal(speech.insertSpeech('library.', 'at dusk', 7).text, 'library at dusk.');
});

test('multilingual text remains unchanged and CJK phrases do not gain spaces', () => {
    for (const phrase of [
        'Create a modern library',
        '创建一个现代图书馆',
        '図書館を作ってください',
        'एक आधुनिक पुस्तकालय बनाएं',
    ]) {
        assert.equal(speech.insertSpeech('', phrase, 0).text, phrase);
    }
    assert.equal(speech.insertSpeech('创建', '图书馆', 2).text, '创建图书馆');
    assert.equal(speech.insertSpeech('図書館', 'を作る', 3).text, '図書館を作る');
});

test('voice button exposes accessible idle, listening, processing, and unsupported states', async () => {
    const { VoiceInputButton } = await server.ssrLoadModule('/src/components/VoiceInputButton.tsx');
    const base = { isSupported: true, isListening: false, isTranscribing: false, error: null };
    const render = (state) =>
        renderToStaticMarkup(
            createElement(VoiceInputButton, {
                speech: { ...base, ...state },
            }),
        );
    assert.match(render({}), /aria-label="Start voice input"/);
    assert.doesNotMatch(render({}), /<select|language-trigger/);
    assert.match(render({ isListening: true }), /aria-label="Stop voice input"/);
    assert.match(render({ isListening: true }), /aria-pressed="true"/);
    assert.match(render({ isTranscribing: true }), /disabled=""/);
    assert.match(render({ isSupported: false }), /not supported in this browser/);
    assert.match(render({ isSupported: false }), /disabled=""/);
    assert.match(
        render({ error: 'Microphone permission is required for voice input.' }),
        /role="alert"/,
    );
});

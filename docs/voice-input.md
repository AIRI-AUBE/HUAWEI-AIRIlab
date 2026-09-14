# Automatic multilingual voice input

Click the existing microphone, grant permission, speak, and click again to stop.
The microphone tracks are released before upload. A small status shows Listening...
or Transcribing... without changing the composer layout. Final text inserts at the
current textarea selection using the existing prompt state. There is no speech
language menu and the application language switcher is unchanged.

## Run locally (PowerShell, from the repository root)

The frontend .env.local now contains this independent speech configuration:

```dotenv
VITE_SPEECH_API_URL=http://localhost:8000
```

Restart Vite after changing it. Leave the variable empty in a deployment that proxies
`/api/transcribe` to Python on the same origin. Do not put server secrets in VITE variables.

```powershell
npm.cmd run dev
```

React uses http://localhost:3000. In another terminal:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
$env:SPEECH_ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000'
$env:WHISPER_MODEL = 'large-v3-turbo'
$env:WHISPER_DEVICE = 'cpu'
$env:WHISPER_COMPUTE_TYPE = 'int8'
backend/.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

The virtual environment and dependencies have been prepared locally. Python 3.14
was used for dependency installation. On macOS/Linux use `.venv/bin/python` and
`export NAME=value` instead of Windows paths and `$env:NAME` assignments.
`backend/.env.example` documents backend settings; Python reads process environment
variables, so that example file is not loaded automatically.

The default multilingual faster-whisper **large-v3-turbo** model loads once at startup and
is cached under `backend/.model-cache`. First startup downloads model weights and
requires internet access and sufficient disk space. Later startup reuses the cache.
CPU int8 is the default; larger multilingual models can improve accuracy at the cost
of memory and latency. English-only `.en` models are rejected. A model load failure
leaves the endpoint returning a friendly 503; inspect Python logs and restart after
correcting configuration or connectivity.

## Recognition and limits

### Connection refused at localhost:8000

Voice transcription requires the Python service as well as Vite. `npm run dev`
starts only React. If the Network tab shows `ERR_CONNECTION_REFUSED` for
`/api/transcribe`, start Python with the command above and wait for Uvicorn to print
`Application startup complete` before recording again. The port is not ready while
the first model download is running. Opening `http://localhost:8000/docs` confirms
that the HTTP service is reachable.

If the initial model download stalls, stop that Python process and restart it with
the standard HTTP downloader (this resolved the local Windows startup issue):

```powershell
$env:HF_HUB_DISABLE_XET = '1'
backend/.venv/Scripts/python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Keep Python running alongside React. No frontend rebuild is needed merely to restart
Python at the same URL.

`useVoiceInput` owns a testable recording controller. It feature-detects MediaRecorder
and getUserMedia, negotiates WebM/Opus, MP4, or Ogg based on browser support, collects
chunks, and sends only an `audio` multipart file to `POST /api/transcribe`. The hook
returns listening/transcribing state, transcript, detectedLanguage, error, and
start/stop/cancel methods. Cancellation and unmount stop capture, abort uploads, and
ignore late permission grants or stale transcripts. Repeat clicks cannot duplicate
a recording or upload.

FastAPI decodes actual audio with PyAV, resamples to mono 16 kHz, and invokes
faster-whisper with `task="transcribe"`, `language=None`, and voice activity detection.
It returns `{"text": "...", "language": "zh"}`. No frontend language is submitted and
no translation task is used. Whisper detects the recording's language. English,
Chinese, Japanese, Korean, Hindi, Tamil, and other languages in the multilingual
model are supported; accuracy varies, especially for short/noisy or mixed-language
recordings. Detection is not a guarantee of perfect transcription.

The backend uses one automatic multilingual decoding pass, without a text prompt
that might bias the recognized words. Repetition penalties discourage decoding
loops, and a guard rejects four consecutive copies of a word or short phrase.
This guard can also reject deliberately repeated speech. Telugu (`te`) output
without Telugu letters is rejected; English words alongside Telugu are allowed.
These checks do not establish word-level accuracy. The previous `small` model
and Telugu instruction prompt were insufficient for reliable Telugu recognition.
Restart Python after backend changes, stopping the existing service before binding
port 8000 again. Remove any old `WHISPER_MODEL=small` environment override to use
the new default. Larger models require additional disk space, RAM, and CPU time.

The recording limit is two minutes and 10 MiB; upload processing has a two-minute
frontend timeout. Multipart requests have a bounded total size, MIME types are
checked, and decoded sample counts enforce duration even with misleading metadata.
Invalid files and silence return friendly errors. Form upload temporary files are
closed/deleted on success and failure. Recordings are not permanently stored.
One inference runs at a time per process; excess requests receive 429.

## Browser and deployment

Use HTTPS or localhost and a browser supporting getUserMedia and MediaRecorder.
The browser microphone permission and device must be available. Browser codec
support varies; no Web Speech API or browser-side Whisper model is required.
Both React and Python must be running. Restart the frontend after changing its URL.

Deploy Python separately or route `/api/transcribe` to it through an HTTPS reverse
proxy. Set SPEECH_ALLOWED_ORIGINS to explicit frontend origins (wildcards are rejected).
Configure proxy request-size limits, request timeouts, authentication and rate limits
before exposing this compute-intensive service publicly; CORS is not authentication.
Keep model weights cached, allow model-loading startup time, and size workers for
available RAM/GPU memory (each process loads its own model). Configure matching
frontend/proxy timeouts for slower hardware. Client cancellation stops waiting;
already-running Python inference may finish before its resources are released.

## Verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run lint
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
backend/.venv/Scripts/python.exe -m unittest backend.test_main -v
```

The repository has no lint script; that command reports Missing script: lint.
Frontend tests exercise recording races, repeated sessions, microphone cleanup,
permission denial, upload cancellation, network errors, textarea insertion, and the
absence of a language dropdown. Python tests exercise real audio decoding with a
stub inference model, original-script response contracts, invalid/empty/oversized
uploads, duration limits, silence responses, cleanup, service failures, and CORS.
These tests do not establish real-world recognition accuracy.

Manual acceptance: record English, Chinese, Japanese, and Hindi; verify the original
script; test with existing textarea text and a selected range; stop immediately
while permission is pending; deny permission; stop Python; record silence; record
multiple times; and navigate away while recording/uploading. Check microphone
release using the browser indicator. Verify templates, image generation, preview,
navigation, and the existing application language switcher continue to work.

References: [faster-whisper](https://github.com/SYSTRAN/faster-whisper),
[FastAPI uploads](https://fastapi.tiangolo.com/tutorial/request-files/),
[FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/).

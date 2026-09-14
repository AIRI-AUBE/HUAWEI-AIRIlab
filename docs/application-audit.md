# Application and multilingual speech audit — 2026-09-14

The existing UI and generation payload contracts were preserved. Automatic speech
recognition already used transcription without translation. Targeted fixes address
recording robustness, invalid responses, generation polling, keyboard interactions,
and small-screen template placement. This is not a certification of recognition
accuracy for every supported language.

## Architecture inspected

- React 19, TypeScript in strict mode, Vite 8, React Router, SCSS, i18next.
- Routes: home, Text-to-Image, Image-to-Image. `WorkspacePage` is an unused placeholder.
- Text voice path: `VoiceInputButton` → `useVoiceInput` → recording controller and
  `transcribeAudio` → FastAPI `/api/transcribe` → PyAV → faster-whisper → existing textarea.
- Text templates use `PromptTemplateModal`; image templates use `V3TemplateSelector`
  and local workbook-derived assets. Upload validation, resize, transactions, reference
  categories, generation state, and previews are separate existing modules.
- Image generation uses the existing remote Universal API, workflow `"44"` for text
  and `39` for image. The local `server` directory contains no implementation.
- Python service uses FastAPI, multipart uploads, PyAV and faster-whisper. Model:
  `large-v3-turbo`, CPU, int8 by default, with explicit environment overrides.
- Existing tests use Node's built-in runner, Vite module loading, React server
  rendering, Python unittest and FastAPI TestClient. Added `playwright-core` only
  for browser automation using installed Chrome; no browser download or new test
  framework. Backend virtual environment and cached weights were already present.
- Inspected application source, components, hooks, data/configuration, styles,
  build/type scripts, existing tests, backend, and environment variable names.
  Secret values were not printed. Existing uncommitted work was retained.

## Findings and changes

| Finding                                                                                                   | Resolution                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate recorder stop callbacks could initiate duplicate uploads                                        | Per-recording upload guard; ignore stale recorder errors                                                                            |
| Frontend trimmed provider response text                                                                   | API helper now preserves exact nonempty response text; existing insertion helper still trims outer dictation whitespace for spacing |
| Backend could return missing/invalid detected language metadata                                           | Validate metadata inside inference error handling; return 503 and release resources                                                 |
| Bare job `status: "completed"` was treated as an API error                                                | Distinguish numeric API envelope status from string job state; validate malformed job responses                                     |
| Polling delays retained abort listeners and missed already-aborted signals                                | Remove settled listeners and reject already-cancelled waits                                                                         |
| Keyboard image removal did not work; child keys opened file picker                                        | Handle Enter/Space for removal and limit upload-container key handling to its own events                                            |
| Image template popover could leave viewport; Escape did not close it                                      | Clamp position, cap viewport height, support Escape and focus                                                                       |
| Blocked localStorage could crash startup/switching; saved Chinese did not set document language on reload | Guard persistence access and initialize document language                                                                           |
| Only a subset of requested languages had preservation coverage                                            | Shared 17-language fixture matrix across controller/API, browser textarea, and backend endpoint tests                               |

No `task="translate"`, forced `language="en"`, browser speech fallback, or frontend
recognition language dropdown exists. The UI language switch does not control STT.
The generation payload's existing `language: "chs"` is unrelated to speech detection
and remains unchanged, as required by the existing workflow contract.

Backend inference still uses `task="transcribe"`, `language=None`, VAD,
`condition_on_previous_text=False`, beam size 5, repetition penalty 1.1 and
`no_repeat_ngram_size=4`. No model/decoder settings were changed during this audit.
The existing repetition guard can reject deliberately repeated speech. The existing
Telugu script guard rejects Latin-only/incorrect-script Telugu results; other
languages do not have equivalent script guards. Neither guard guarantees accuracy.

## Language matrix and actual results

Each row passed exact text/code preservation with mocked responses in frontend
contracts and backend endpoint tests; browser tests check exact React textarea text.
The backend contract tests decode a real silent WAV but mock model inference.
These are not language-detection accuracy tests.

| Language   | Code | Expected script/text  | Real inference                          |
| ---------- | ---- | --------------------- | --------------------------------------- |
| English    | en   | Latin / English       | PASS: synthetic WAV, exact phrase, `en` |
| Chinese    | zh   | Han characters        | Not tested: no recording                |
| Japanese   | ja   | Japanese script       | Not tested: no recording                |
| Korean     | ko   | Hangul                | Not tested: no recording                |
| French     | fr   | French Latin text     | Not tested: no recording                |
| German     | de   | German Latin text     | Not tested: no recording                |
| Spanish    | es   | Spanish Latin text    | Not tested: no recording                |
| Italian    | it   | Italian Latin text    | Not tested: no recording                |
| Portuguese | pt   | Portuguese Latin text | Not tested: no recording                |
| Russian    | ru   | Cyrillic              | Not tested: no recording                |
| Arabic     | ar   | Arabic script         | Not tested: no recording                |
| Hindi      | hi   | Devanagari            | Not tested: no recording                |
| Tamil      | ta   | Tamil script          | Not tested: no recording                |
| Telugu     | te   | Telugu script         | Not tested: no recording                |
| Malayalam  | ml   | Malayalam script      | Not tested: no recording                |
| Kannada    | kn   | Kannada script        | Not tested: no recording                |
| Bengali    | bn   | Bengali script        | Not tested: no recording                |

Exact representative phrases are in `tests/fixtures/speech/languages.json`.
English actual output: `{"text":"Create a modern library at dusk","language":"en"}`,
HTTP 200. Real one-second silence: HTTP 422, `No speech detected.` Cached default
model startup succeeded. See `audit-real-audio-results.json` for unedited results.
An English-only sample cannot establish absence of English translation for other
languages; that conclusion is limited to code inspection and mock preservation.

## Test coverage and results

- Frontend: 62 Node tests passed, plus both TypeScript configurations. Covers both
  payload mappers, upload transactions, reference options/limits, template races,
  polling success/errors/cancellation, speech sessions, permission denial, cleanup,
  late permission grants, cancellation, duplicate stops, size and time limits,
  malformed/network/HTTP responses, exact language metadata, and cursor insertion.
- Backend: 12 unittest methods passed, including 17 language subcases. Covers real
  WAV decoding with mocked inference, multipart validation, MIME/size/duration
  limits, no-speech responses, errors, temporary-file cleanup, lock release,
  unavailable/busy service, and allowed/disallowed CORS origins. Python syntax passed.
- Browser: all 6 scenarios passed in headless installed Chrome; actual React routing/events/hooks and DOM.
  All 17 mocked transcripts, empty/existing/CJK/selected-range insertion, retry,
  processing disabled state, navigation cleanup, templates, language switching,
  text/image generation and previews with mocked APIs, keyboard removal, blocked
  storage, unsupported capture, viewport checks at 1440/768/390 pixels.
- Native browser recording: synthetic Chrome microphone with real MediaRecorder,
  encoded multipart bytes and track release; STT response mocked.
- Real inference: synthetic English WAV and silence through the real endpoint in
  TestClient. Physical microphone: not tested. External image-generation service:
  not called; browser tests replace credentials and intercept network requests.
- Build passed. `npm run lint` cannot run: repository has no lint script/config.
  No lint pass is claimed. `npm run format:check` found 52 files with formatting
  differences, mostly pre-existing; broad formatting was avoided. Changed/new
  JavaScript/TypeScript and audit artifacts were formatted separately.
- An initial browser rerun timed out during cold startup while CPU inference was
  running; navigation timeout was adjusted. A navigation-cleanup assertion was
  changed to await React's cleanup instead of reading immediately after click.

## Files changed by this audit

- `src/features/speech/voiceInput.ts`, `backend/main.py`: speech robustness/validation.
- `src/features/generation/universalGeneration.ts`: response parsing/cancellation.
- `src/components/ImageUploadField.tsx`, `src/components/V3TemplateSelector.tsx`,
  `src/styles/main.scss`: keyboard/viewport fixes, preserving styling.
- `src/i18n.ts`, `src/components/AppLayout.tsx`: storage and document language.
- `tests/speech-recognition.test.mjs`, `tests/generation-workflows.test.mjs`,
  `backend/test_main.py`: expanded regression tests.
- `tests/browser-audit.test.mjs`: browser regression suite.
- `tests/fixtures/speech/{languages.json,en.wav,README.md}`: shared matrix/fixture.
- `backend/audit_audio.py`, `docs/audit-real-audio-results.json`: real inference runner/results.
- `package.json`, `package-lock.json`, `.gitignore`: browser driver, script, local cache ignore.
- `docs/application-audit.md`: this report.

Other dirty files, including `index.html`, the original voice UI/hook integration,
and existing voice documentation, predated this audit and were not replaced.

## Commands and environment

Executed from the project root on Windows:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd install --save-dev playwright-core --cache .npm-cache --ignore-scripts
npm.cmd run test:browser
npm.cmd run build
npm.cmd run format:check
backend/.venv/Scripts/python.exe -m unittest backend.test_main -v
backend/.venv/Scripts/python.exe -m py_compile backend/main.py backend/test_main.py
backend/.venv/Scripts/python.exe -m backend.audit_audio
git diff --check
```

Browser tests locate installed Chrome/Edge; set `BROWSER_EXECUTABLE` if needed.
Fixture generation used Windows `System.Speech.Synthesis.SpeechSynthesizer`,
`SetOutputToWaveFile('tests/fixtures/speech/en.wav')`, and
`Speak('Create a modern library at dusk')` with an absolute output path.

Required deployment configuration depends on topology:

- `VITE_SPEECH_API_URL`: Python origin, or empty with a same-origin `/api/transcribe`
  proxy. Local example is `http://localhost:8000`; restart Vite after changes.
- `SPEECH_ALLOWED_ORIGINS`: explicit frontend origins. Default localhost port 3000.
- Optional `WHISPER_MODEL`, `WHISPER_DEVICE`, `WHISPER_COMPUTE_TYPE`; defaults above.
  Python does not automatically load `backend/.env.example`.
- Generation: `VITE_AIRI_API_BASE_URL`, numeric `VITE_AIRI_PROJECT_ID`,
  `VITE_AIRI_TEAM_ID`; optional `VITE_AIRI_UPLOAD_PATH`, `VITE_AIRI_PROJECT_NAME`,
  `VITE_AIRI_AUTH_TOKEN`, `VITE_AIRI_API_KEY` according to the existing deployment.
- `GROQ_API_KEY` appears in local environment configuration but is unused by the
  current source. The local Whisper speech pipeline requires no provider API key.

## Remaining limitations and follow-up

1. Add actual native-speaker recordings for the other 16 languages and review
   script, meaning, omissions, transliteration, and translation. Repeat with accents,
   noise, very short prompts and mixed-language speech. The fixture README explains
   the process. Additional provider-supported languages were not exhaustively tested.
2. Perform physical microphone acceptance in target browsers/OSs; Safari/Firefox
   codecs and real permission/device failures were not exercised on hardware.
3. Existing `VITE_AIRI_AUTH_TOKEN`/`VITE_AIRI_API_KEY` support puts configured values
   in browser-delivered code. This is an existing generation-auth architecture issue,
   not an STT secret leak. Use a server proxy or scoped user-session authentication
   for production secrets. No credential was removed or bypassed during this audit.
4. Real generation success/authentication and production CORS/proxy routing remain
   unverified. Mocked workflow tests do not establish remote service availability.
5. Frontend timeout aborts waiting after two minutes; backend inference may continue
   until completion. CPU/model latency must be checked on deployment hardware.
6. Backend multipart files may spool temporarily and are closed by the form context.
   No permanent recording store is used. The inference lock is per process.
7. No complete visual screenshot comparison or every possible responsive width was
   performed. No existing design was replaced. No lint tooling was invented simply
   to report a green lint command; choose repository lint policy separately.
8. FastAPI TestClient emitted an existing httpx deprecation warning; tests passed.
   Dependency versions were not broadly upgraded as part of this audit.

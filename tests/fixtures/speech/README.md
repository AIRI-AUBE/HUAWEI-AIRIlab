# Speech audit fixtures

`languages.json` contains 17 representative spoken phrases, expected detected codes,
and scripts. It drives frontend contracts, browser textarea tests, and backend
endpoint contracts. Mock success proves preservation, not recognition accuracy.

`en.wav` is synthetic English speech generated locally with the default installed
Windows System.Speech voice on 2026-09-14. It says “Create a modern library at dusk”.
It is not a live microphone recording. No human/private audio is included.

To extend real inference coverage, record each phrase naturally in its stated
language and save mono/stereo WAV as `<code>.wav` here, for example `zh.wav`, `ta.wav`,
or `te.wav`. Use consenting speakers, short clear recordings (under two minutes and
10 MiB), and no translation or transliteration of the phrase. Keep noisy, accented,
and mixed-language acceptance samples separately with their reference transcripts.

Run from the project root:

```powershell
backend/.venv/Scripts/python.exe -m backend.audit_audio
```

The script loads the configured model through the real FastAPI lifespan and sends
multipart requests through TestClient, including actual decoding and inference.
It uses cached model weights offline by default. It writes actual text, detected
language, HTTP status, and missing-fixture status to
`docs/audit-real-audio-results.json`. Missing recordings are never passes.
Review meaning and script manually; a matching language code alone is insufficient.

The browser suite additionally exercises native Chrome MediaRecorder with Chrome's
synthetic microphone and a mocked STT response. This verifies capture/upload/track
cleanup, not a physical microphone or real recognition.

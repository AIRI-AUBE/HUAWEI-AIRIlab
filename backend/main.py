"""Independent multilingual speech service. Run: python -m uvicorn backend.main:app."""

from contextlib import asynccontextmanager
import logging
import os
import unicodedata
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.responses import JSONResponse

MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024
MAX_SECONDS = 120
SAMPLE_RATE = 16000
AUDIO_TYPES = {"audio/webm", "video/webm", "audio/mp4", "video/mp4", "audio/ogg", "application/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/flac"}
logger = logging.getLogger(__name__)
DEFAULT_MODEL = "large-v3-turbo"


def has_repetition_loop(text):
    # Preserve vowel marks in Indic scripts; punctuation does not distinguish
    # successive copies of the same hallucinated word or short phrase.
    normalized = "".join(
        " " if unicodedata.category(char).startswith("P") else char
        for char in unicodedata.normalize("NFC", text).casefold()
    )
    words = normalized.split()
    for width in range(1, 5):
        for start in range(len(words) - width * 4 + 1):
            phrase = words[start:start + width]
            if words[start:start + width * 4] == phrase * 4:
                return True
    return False


class UploadLimitMiddleware:
    """Bound the entire multipart body, including chunked requests, before parsing it."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] != "/api/transcribe":
            return await self.app(scope, receive, send)
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message.get("body", b"")
            if len(body) + len(chunk) > MAX_REQUEST_BYTES:
                return await JSONResponse({"detail": "Recording is too large."}, status_code=413)(scope, receive, send)
            body.extend(chunk)
            if not message.get("more_body", False):
                break
        consumed = False

        async def limited_receive():
            nonlocal consumed
            if not consumed:
                consumed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, limited_receive, send)


def decode_recording(file):
    """Decode actual audio, enforcing a sample limit even when metadata lies."""
    import av
    import numpy as np

    chunks = []
    count = 0
    try:
        with av.open(file, mode="r") as container:
            if not container.streams.audio:
                raise ValueError("No audio stream")
            resampler = av.AudioResampler(format="fltp", layout="mono", rate=SAMPLE_RATE)

            def collect(frames):
                nonlocal count
                for frame in frames:
                    count += frame.samples
                    if count > SAMPLE_RATE * MAX_SECONDS:
                        raise HTTPException(413, "Recording exceeds two minutes.")
                    chunks.append(frame.to_ndarray().reshape(-1))

            for frame in container.decode(audio=0):
                collect(resampler.resample(frame))
            collect(resampler.resample(None))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, "Invalid audio. Please try again.") from exc
    if not count:
        raise HTTPException(422, "No speech detected.")
    return np.concatenate(chunks).astype(np.float32, copy=False)


def transcribe_file(model, audio):
    samples = decode_recording(audio.file)
    try:
        segments, info = model.transcribe(
            samples,
            task="transcribe",
            language=None,
            vad_filter=True,
            condition_on_previous_text=False,
            beam_size=5,
            repetition_penalty=1.1,
            no_repeat_ngram_size=4,
        )
        text = "".join(segment.text for segment in segments).strip()
        language = info.language
        if not isinstance(language, str) or not language.strip():
            raise ValueError("Missing detected language")
    except Exception as exc:
        logger.exception("Speech inference failed")
        raise HTTPException(503, "Speech service is unavailable. Please try again.") from exc
    if not text:
        raise HTTPException(422, "No speech detected.")
    if has_repetition_loop(text):
        raise HTTPException(422, "Speech recognition was unreliable. Please record again.")
    if language == "te" and not any(
        "\u0c00" <= char <= "\u0c7f" and char.isalpha() for char in text
    ):
        raise HTTPException(
            422, "Could not transcribe Telugu reliably. Please record again and speak clearly."
        )
    return {"text": text, "language": language}


def create_app(model_factory=None):
    def load_model():
        from faster_whisper import WhisperModel

        model_name = os.getenv("WHISPER_MODEL", DEFAULT_MODEL)
        logger.info("Loading speech model %s", model_name)
        model = WhisperModel(
            model_name,
            device=os.getenv("WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
            download_root=str(Path(__file__).parent / '.model-cache'),
        )
        if not model.model.is_multilingual:
            raise ValueError("WHISPER_MODEL must be multilingual, not an English-only model.")
        return model

    @asynccontextmanager
    async def lifespan(app):
        app.state.model = None
        app.state.inference_lock = Lock()
        try:
            app.state.model = await run_in_threadpool(model_factory or load_model)
        except Exception:
            logger.exception("Unable to load multilingual speech model")
        yield
        app.state.model = None

    app = FastAPI(lifespan=lifespan)
    app.add_middleware(UploadLimitMiddleware)
    origins = [origin.strip() for origin in os.getenv(
        "SPEECH_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origin.strip()]
    if "*" in origins:
        raise ValueError("Set explicit SPEECH_ALLOWED_ORIGINS instead of '*'.")
    app.add_middleware(CORSMiddleware, allow_origins=origins,
                       allow_methods=["POST"], allow_headers=["Content-Type"])

    @app.post("/api/transcribe")
    async def transcribe(request: Request):
        if app.state.model is None:
            raise HTTPException(503, "Speech service is unavailable.")
        if not app.state.inference_lock.acquire(blocking=False):
            raise HTTPException(429, "Speech service is busy. Please try again.")
        try:
            async with request.form(max_files=1, max_fields=0) as form:
                audio = form.get("audio")
                if not isinstance(audio, UploadFile):
                    raise HTTPException(422, "An audio recording is required.")
                if (audio.content_type or "").split(";", 1)[0].lower() not in AUDIO_TYPES:
                    raise HTTPException(415, "Unsupported audio format.")
                if not audio.size:
                    raise HTTPException(422, "No audio recorded.")
                if audio.size > MAX_AUDIO_BYTES:
                    raise HTTPException(413, "Recording is too large.")
                return await run_in_threadpool(transcribe_file, app.state.model, audio)
            # The form context closes/deletes spooled temporary files on every path.
        finally:
            app.state.inference_lock.release()

    return app


app = create_app()

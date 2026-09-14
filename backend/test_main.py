import io
import json
from pathlib import Path
import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import wave

from fastapi.testclient import TestClient
from backend import main


def wav_audio(seconds=0.1):
    data = io.BytesIO()
    with wave.open(data, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\0\0" * int(16000 * seconds))
    return data.getvalue()


class SpeechTests(unittest.TestCase):
    def test_default_model_and_explicit_override(self):
        for override, expected in [(None, "large-v3-turbo"), ("medium", "medium")]:
            with self.subTest(override=override), patch.dict(os.environ, {}, clear=True):
                if override:
                    os.environ["WHISPER_MODEL"] = override
                with patch("faster_whisper.WhisperModel") as factory:
                    factory.return_value.model.is_multilingual = True
                    with TestClient(main.create_app()):
                        self.assertEqual(factory.call_args.args[0], expected)
                        self.assertEqual(factory.call_args.kwargs["compute_type"], "int8")

    def test_telugu_decodes_once_without_prompt_bias(self):
        calls = []

        def transcribe(samples, **options):
            calls.append(options)
            self.assertIsNone(options["language"])
            self.assertEqual(options["task"], "transcribe")
            self.assertNotIn("initial_prompt", options)
            self.assertGreater(options["repetition_penalty"], 1)
            self.assertGreater(options["no_repeat_ngram_size"], 0)
            return iter([SimpleNamespace(text="నా పేరు సంతోష్"),
                         SimpleNamespace(text=" మీరెలా ఉన్నారు?")]), SimpleNamespace(language="te")

        with TestClient(main.create_app(lambda: SimpleNamespace(transcribe=transcribe))) as client:
            response = client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"text": "నా పేరు సంతోష్ మీరెలా ఉన్నారు?", "language": "te"})
            self.assertEqual(len(calls), 1)

    def test_repeated_hallucination_is_rejected(self):
        for text in ["మళ్ళీ " * 15, "మళ్ళీ, " * 5, "మీరు ఎలా " * 5]:
            with self.subTest(text=text):
                model = SimpleNamespace(transcribe=lambda *_args, **_kwargs: (
                    iter([SimpleNamespace(text=text)]), SimpleNamespace(language="te")))
                with TestClient(main.create_app(lambda: model)) as client:
                    response = client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")})
                    self.assertEqual(response.status_code, 422)
                    self.assertIn("unreliable", response.json()["detail"])
                    self.assertFalse(client.app.state.inference_lock.locked())

    def test_repetition_guard_preserves_normal_phrases(self):
        for text in ["మీరు ఎలా ఉన్నారు?", "చాలా చాలా బాగుంది", "very very beautiful",
                     "మా మీ మే మో", "one two three four five six"]:
            with self.subTest(text=text):
                self.assertFalse(main.has_repetition_loop(text))

    def test_telugu_wrong_script_is_not_returned_as_success(self):
        for text in ["ना पेर सन्तोष", "naa peru santosh", "౧౨౩", ""]:
            with self.subTest(text=text):
                model = SimpleNamespace(transcribe=lambda *_args, **_kwargs: (
                    iter([SimpleNamespace(text=text)]), SimpleNamespace(language="te")))
                with TestClient(main.create_app(lambda: model)) as client:
                    response = client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")})
                    self.assertEqual(response.status_code, 422)
                    self.assertFalse(client.app.state.inference_lock.locked())

    def test_telugu_allows_english_words_alongside_native_script(self):
        model = SimpleNamespace(transcribe=lambda *_args, **_kwargs: (
            iter([SimpleNamespace(text="ఒక Huawei phone చిత్రం")]), SimpleNamespace(language="te")))
        with TestClient(main.create_app(lambda: model)) as client:
            response = client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["text"], "ఒక Huawei phone చిత్రం")

    def test_multilingual_transcription_contract(self):
        matrix = json.loads((Path(__file__).parents[1] / "tests/fixtures/speech/languages.json").read_text(encoding="utf-8"))
        for sample in matrix:
            language, text = sample["language"], sample["text"]
            with self.subTest(language=language):
                def transcribe(samples, **options):
                    self.assertEqual(options["task"], "transcribe")
                    self.assertIsNone(options["language"])
                    self.assertTrue(options["vad_filter"])
                    self.assertGreater(len(samples), 0)
                    return iter([SimpleNamespace(text=text)]), SimpleNamespace(language=language)
                with TestClient(main.create_app(lambda: SimpleNamespace(transcribe=transcribe))) as client:
                    response = client.post("/api/transcribe", files={"audio": ("audio.wav", wav_audio(), "audio/wav")})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json(), {"text": text, "language": language})

    def test_invalid_language_metadata_is_service_error(self):
        for language in [None, "", " ", 42]:
            model = SimpleNamespace(transcribe=lambda *_args, **_kwargs: (
                iter([SimpleNamespace(text="A library")]), SimpleNamespace(language=language)))
            with TestClient(main.create_app(lambda: model)) as client, self.assertLogs(main.logger, level="ERROR"):
                response = client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")})
                self.assertEqual(response.status_code, 503)
                self.assertFalse(client.app.state.inference_lock.locked())

    def test_validation_and_no_speech(self):
        model = SimpleNamespace(transcribe=lambda *_args, **_kwargs: ([], SimpleNamespace(language="en")))
        with TestClient(main.create_app(lambda: model)) as client:
            for content, mime, expected in [(b"", "audio/webm", 422), (b"bad", "text/plain", 415),
                                             (b"bad", "audio/webm", 422), (wav_audio(), "audio/wav", 422)]:
                response = client.post("/api/transcribe", files={"audio": ("audio", content, mime)})
                self.assertEqual(response.status_code, expected)
            self.assertEqual(client.post("/api/transcribe").status_code, 422)
            with patch.object(main, "MAX_REQUEST_BYTES", 10):
                self.assertEqual(client.post("/api/transcribe", content=b"x" * 11).status_code, 413)
            with patch.object(main, "MAX_AUDIO_BYTES", 10):
                self.assertEqual(client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")}).status_code, 413)
            with patch.object(main, "MAX_SECONDS", 0.01):
                self.assertEqual(client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")}).status_code, 413)

    def test_failure_closes_temporary_file_and_releases_lock(self):
        files = []
        original_decode = main.decode_recording
        def capture(file):
            files.append(file)
            return original_decode(file)
        def broken(*_args, **_kwargs):
            raise RuntimeError("private failure")
        with TestClient(main.create_app(lambda: SimpleNamespace(transcribe=broken))) as client:
            with patch.object(main, "decode_recording", capture), self.assertLogs(main.logger, level="ERROR"):
                response = client.post("/api/transcribe", files={"audio": ("a.wav", wav_audio(), "audio/wav")})
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("private", response.text)
            self.assertTrue(files[0].closed)
            self.assertFalse(client.app.state.inference_lock.locked())

    def test_service_unavailable_and_cors(self):
        def broken():
            raise RuntimeError("model unavailable")
        with self.assertLogs(main.logger, level="ERROR"), TestClient(main.create_app(broken)) as client:
            self.assertEqual(client.post("/api/transcribe").status_code, 503)
            response = client.options("/api/transcribe", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
            self.assertEqual(response.headers["access-control-allow-origin"], "http://localhost:3000")
            response = client.options("/api/transcribe", headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"})
            self.assertNotIn("access-control-allow-origin", response.headers)

    def test_busy_service_rejects_extra_work(self):
        with TestClient(main.create_app(lambda: object())) as client:
            client.app.state.inference_lock.acquire()
            try:
                self.assertEqual(client.post("/api/transcribe").status_code, 429)
            finally:
                client.app.state.inference_lock.release()


if __name__ == "__main__":
    unittest.main()

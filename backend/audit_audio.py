"""Run optional recorded fixtures through the real endpoint and cached model.

Run from repository root: backend/.venv/Scripts/python.exe -m backend.audit_audio
No missing fixtures are counted as passes. Outputs require human semantic review.
"""
import json
import os
from pathlib import Path

os.environ.setdefault("HF_HUB_OFFLINE", "1")
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.test_main import wav_audio


def main():
    root = Path(__file__).parents[1]
    fixtures = root / "tests/fixtures/speech"
    matrix = json.loads((fixtures / "languages.json").read_text(encoding="utf-8"))
    results = []
    with TestClient(create_app()) as client:
        if client.app.state.model is None:
            raise RuntimeError("Cached multilingual model could not load; no real inference tested")
        print("Real multilingual model loaded", flush=True)
        for sample in matrix:
            path = fixtures / (sample["language"] + ".wav")
            if not path.exists():
                results.append({**sample, "status": "not tested: recording missing"})
                continue
            with path.open("rb") as audio:
                response = client.post("/api/transcribe", files={"audio": (path.name, audio, "audio/wav")})
            result = {**sample, "http_status": response.status_code, "actual": response.json()}
            result["language_matches"] = response.status_code == 200 and response.json().get("language") == sample["language"]
            results.append(result)
            print(json.dumps(result, ensure_ascii=True), flush=True)
        silence = client.post("/api/transcribe", files={"audio": ("silence.wav", wav_audio(1), "audio/wav")})
        results.append({"name": "Silence", "http_status": silence.status_code, "actual": silence.json()})
    destination = root / "docs/audit-real-audio-results.json"
    destination.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Results saved to {destination}", flush=True)
    if any(result.get("language_matches") is False for result in results) or silence.status_code != 422:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

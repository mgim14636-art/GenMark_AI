import base64

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.api.routes import generation

client = TestClient(app, raise_server_exceptions=False)


def test_health_reports_real_readiness():
    """계약 §13: 프로세스가 떴다는 이유만으로 ok를 반환하지 않는다.

    데이터가 준비됐으면 200 + ready, 아니면 503 + not_ready.
    """
    response = client.get("/health")
    body = response.json()

    assert body["status"] in {"ready", "not_ready"}
    assert body["status"] != "ok"

    if body["status"] == "ready":
        assert response.status_code == 200
        assert body["recordCount"] == body["metadataCount"]
        assert body["embeddingDimension"] == 768
    else:
        assert response.status_code == 503
        assert body["reason"]


def test_generation(monkeypatch):
    symbols = [Image.new("RGBA", (16, 16), (20 * index, 40, 80, 255)) for index in range(1, 5)]
    monkeypatch.setattr(
        generation.flux_service,
        "generate_logo_from_survey",
        lambda survey, num_variants: symbols[:num_variants],
    )
    monkeypatch.setattr(
        generation.logo_composer,
        "compose_final_logo",
        lambda symbol, survey: symbol,
    )

    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "brand_name": "GenMark", "num_variants": 4},
    )

    assert response.status_code == 200
    logos = response.json()["logos"]
    assert len(logos) == 4
    assert all(base64.b64decode(logo["imageBase64"]).startswith(b"\x89PNG") for logo in logos)

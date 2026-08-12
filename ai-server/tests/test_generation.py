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


def _fake_variants(monkeypatch, captured=None):
    symbols = [Image.new("RGBA", (16, 16), (20 * index, 40, 80, 255)) for index in range(1, 9)]

    def fake(survey, num_variants=4, steps=None, variant_offset=0):
        if captured is not None:
            captured["variant_offset"] = variant_offset
        return [
            {"image": symbols[i], "seed": 1000 + i, "variant_index": variant_offset + i}
            for i in range(num_variants)
        ]

    monkeypatch.setattr(generation.logo_gen_service, "generate_logo_variants", fake)
    monkeypatch.setattr(
        generation.logo_composer,
        "compose_final_logo",
        lambda symbol, survey, variant_index=None: symbol,
    )


def test_generation(monkeypatch):
    _fake_variants(monkeypatch)

    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "brand_name": "GenMark", "num_variants": 4},
    )

    assert response.status_code == 200
    logos = response.json()["logos"]
    assert len(logos) == 4
    assert all(base64.b64decode(logo["imageBase64"]).startswith(b"\x89PNG") for logo in logos)
    # 백엔드 ai_metadata_json 저장용 필드가 실제로 실려 나가는지
    assert [logo["variantIndex"] for logo in logos] == [0, 1, 2, 3]
    assert all(logo["seed"] is not None for logo in logos)


def test_generation_variant_offset_is_passed_through(monkeypatch):
    """재생성(F12-2): variant_offset이 프롬프트 조립까지 전달돼야 효과가 있다."""
    captured = {}
    _fake_variants(monkeypatch, captured)

    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "brand_name": "GenMark", "num_variants": 4, "variant_offset": 4},
    )

    assert response.status_code == 200
    assert captured["variant_offset"] == 4
    assert [logo["variantIndex"] for logo in response.json()["logos"]] == [4, 5, 6, 7]


def test_generation_ignores_unknown_keys(monkeypatch):
    """백엔드가 아직 avoid_logos를 보내도 기존 생성이 깨지지 않아야 한다."""
    _fake_variants(monkeypatch)

    response = client.post(
        "/api/v1/generation/generate",
        json={
            "ci_bi": "BI",
            "brand_name": "GenMark",
            "num_variants": 2,
            "avoid_logos": [{"candidate_id": "uuid-1", "storage_key": "logos/x/1.png"}],
        },
    )

    assert response.status_code == 200
    assert len(response.json()["logos"]) == 2

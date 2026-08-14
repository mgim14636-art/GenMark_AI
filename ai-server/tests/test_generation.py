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

    def fake(survey, num_variants=1, steps=None, variant_offset=0):
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
        json={"ci_bi": "BI", "brand_name": "GenMark", "num_variants": 1},
    )

    assert response.status_code == 200
    logos = response.json()["logos"]
    assert len(logos) == 1
    assert all(base64.b64decode(logo["imageBase64"]).startswith(b"\x89PNG") for logo in logos)
    # 백엔드 ai_metadata_json 저장용 필드가 실제로 실려 나가는지
    assert [logo["variantIndex"] for logo in logos] == [0]
    assert all(logo["seed"] is not None for logo in logos)


def test_generation_returns_composed_svg(monkeypatch):
    def fake_variants(survey, num_variants=1, steps=None, variant_offset=0):
        return [{
            "image": Image.new("RGBA", (16, 16), (20, 40, 80, 255)),
            "svg": '<svg viewBox="0 0 16 16"><path d="M0 0h16v16z"/></svg>',
            "seed": None,
            "variant_index": variant_offset,
        }]

    monkeypatch.setattr(generation.logo_gen_service, "generate_logo_variants", fake_variants)
    monkeypatch.setattr(
        generation.logo_composer,
        "compose_final_logo",
        lambda symbol, survey, variant_index=None: symbol,
    )
    monkeypatch.setattr(
        generation.svg_composer,
        "compose_svg_logo",
        lambda svg, survey, variant_index=0: f'<svg data-variant="{variant_index}">{svg}</svg>',
    )

    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "brand_name": "GenMark"},
    )

    assert response.status_code == 200
    assert response.json()["logos"][0]["svg"].startswith('<svg data-variant="0">')


def test_generation_variant_offset_is_passed_through(monkeypatch):
    """재생성(F12-2): variant_offset이 프롬프트 조립까지 전달돼야 효과가 있다."""
    captured = {}
    _fake_variants(monkeypatch, captured)

    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "brand_name": "GenMark", "num_variants": 1, "variant_offset": 4},
    )

    assert response.status_code == 200
    assert captured["variant_offset"] == 4
    assert [logo["variantIndex"] for logo in response.json()["logos"]] == [4]


def test_generation_ignores_unknown_keys(monkeypatch):
    """백엔드가 아직 avoid_logos를 보내도 기존 생성이 깨지지 않아야 한다."""
    _fake_variants(monkeypatch)

    response = client.post(
        "/api/v1/generation/generate",
        json={
            "ci_bi": "BI",
            "brand_name": "GenMark",
            "num_variants": 1,
            "avoid_logos": [{"candidate_id": "uuid-1", "storage_key": "logos/x/1.png"}],
        },
    )

    assert response.status_code == 200
    assert len(response.json()["logos"]) == 1


def test_generation_rejects_more_than_one_variant():
    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "brand_name": "GenMark", "num_variants": 2},
    )

    assert response.status_code == 422


def test_generation_enriches_value_keywords_once_per_request(monkeypatch):
    captured = {}
    calls = []
    _fake_variants(monkeypatch, captured)

    def fake_enrich(survey):
        calls.append(survey)
        return {**survey, "value_keywords_en": ["trustworthy", "innovative"]}

    def fake_variants(survey, num_variants=1, steps=None, variant_offset=0):
        captured["survey"] = survey
        return [
            {
                "image": Image.new("RGBA", (16, 16), (20 * index, 40, 80, 255)),
                "seed": 1000 + index,
                "variant_index": index,
            }
            for index in range(num_variants)
        ]

    monkeypatch.setattr(generation.value_keyword_service, "enrich_value_keywords", fake_enrich)
    monkeypatch.setattr(generation.logo_gen_service, "generate_logo_variants", fake_variants)

    response = client.post(
        "/api/v1/generation/generate",
        json={
            "ci_bi": "BI",
            "brand_name": "GenMark",
            "brand_description": "사람을 믿고 혁신합니다",
            "num_variants": 1,
        },
    )

    assert response.status_code == 200
    assert len(calls) == 1
    assert captured["survey"]["value_keywords_en"] == ["trustworthy", "innovative"]

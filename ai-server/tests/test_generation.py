import base64
from io import BytesIO

import pytest
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
    assert response.json()["modelName"] == generation.logo_gen_service.OPENROUTER_MODEL
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


@pytest.mark.parametrize("style", ["wordmark", "lettermark", " WORDMARK ", "Lettermark"])
def test_text_only_styles_skip_all_remote_generation(monkeypatch, style):
    monkeypatch.setattr(
        generation.value_keyword_service,
        "enrich_value_keywords",
        lambda *_: (_ for _ in ()).throw(AssertionError("value enrichment must be skipped")),
    )
    monkeypatch.setattr(
        generation.motif_translation_service,
        "enrich_logo_shape",
        lambda *_: (_ for _ in ()).throw(AssertionError("motif translation must be skipped")),
    )
    monkeypatch.setattr(
        generation.logo_gen_service,
        "generate_logo_variants",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("image API must be skipped")),
    )
    monkeypatch.setattr(
        generation.logo_composer,
        "compose_final_logo",
        lambda symbol, survey, variant_index=None: Image.new("RGBA", (32, 32), (10, 20, 30, 255)),
    )

    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "brand_name": "GenMark", "style": style, "variant_offset": 3},
    )

    assert response.status_code == 200
    assert response.json()["modelName"] == "local/pillow"
    assert response.json()["logos"][0]["variantIndex"] == 3
    assert response.json()["logos"][0]["seed"] is None
    assert response.json()["logos"][0]["svg"] is None


@pytest.mark.parametrize("style", ["wordmark", "lettermark", " WORDMARK ", "Lettermark"])
def test_text_only_styles_reject_missing_name_before_remote_generation(monkeypatch, style):
    monkeypatch.setattr(
        generation.logo_gen_service,
        "generate_logo_variants",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("image API must be skipped")),
    )

    response = client.post(
        "/api/v1/generation/generate",
        json={"ci_bi": "BI", "style": style},
    )

    assert response.status_code == 422


def test_wordmark_uses_first_manual_palette_color():
    image = generation.logo_composer.compose_final_logo(
        None,
        {
            "ci_bi": "BI",
            "brand_name": "GenMark",
            "style": "wordmark",
            "color_mode": "manual",
            "color_manual": ["#FF0000", "#000000"],
        },
    )

    assert any(r > 200 and g < 30 and b < 30 and a > 0 for r, g, b, a in image.getdata())


def test_rasterize_svg_returns_1024_png_base64(monkeypatch):
    captured = {}

    def fake_rasterize(svg, size=1024):
        captured["svg"] = svg
        captured["size"] = size
        return Image.new("RGBA", (size, size), (10, 20, 30, 255))

    monkeypatch.setattr(generation.logo_gen_service, "rasterize_svg", fake_rasterize)
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>'

    response = client.post("/api/v1/generation/rasterize-svg", json={"svg": svg})

    assert response.status_code == 200
    body = response.json()
    png = base64.b64decode(body["imageBase64"])
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    assert body["width"] == 1024
    assert body["height"] == 1024
    assert captured == {"svg": svg, "size": 1024}


def test_rasterize_svg_uses_real_renderer_for_simple_document():
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
        '<path d="M1 1 L9 1 L9 9 L1 9 Z" fill="rgb(51,102,153)"/>'
        '</svg>'
    )

    response = client.post("/api/v1/generation/rasterize-svg", json={"svg": svg})

    assert response.status_code == 200
    png = base64.b64decode(response.json()["imageBase64"])
    assert png.startswith(b"\x89PNG\r\n\x1a\n")
    rendered = Image.open(BytesIO(png)).convert("RGBA")
    assert rendered.size == (1024, 1024)
    assert rendered.getpixel((512, 512))[:3] == (0x33, 0x66, 0x99)
    assert rendered.getpixel((512, 512))[3] > 0


def test_rasterize_svg_rejects_payload_over_one_megabyte(monkeypatch):
    called = False

    def fake_rasterize(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(generation.logo_gen_service, "rasterize_svg", fake_rasterize)
    oversized = '<svg xmlns="http://www.w3.org/2000/svg">' + (" " * 1_048_576) + "</svg>"

    response = client.post("/api/v1/generation/rasterize-svg", json={"svg": oversized})

    assert response.status_code == 400
    assert called is False


def test_rasterize_svg_rejects_excessive_element_count(monkeypatch):
    called = False

    def fake_rasterize(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(generation.logo_gen_service, "rasterize_svg", fake_rasterize)
    svg = '<svg xmlns="http://www.w3.org/2000/svg">' + ('<g/>' * 10_001) + '</svg>'

    response = client.post("/api/v1/generation/rasterize-svg", json={"svg": svg})

    assert response.status_code == 400
    assert called is False


@pytest.mark.parametrize(
    "unsafe_svg",
    [
        '<!DOCTYPE svg SYSTEM "https://example.com/evil.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/logo.png"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" xml:base="https://example.com/"><use href="#logo"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>unsafe</div></foreignObject></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><style>path { fill: red; }</style></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:red" d="M0 0h1v1z"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    ],
)
def test_rasterize_svg_rejects_unsafe_content(monkeypatch, unsafe_svg):
    called = False

    def fake_rasterize(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(generation.logo_gen_service, "rasterize_svg", fake_rasterize)

    response = client.post("/api/v1/generation/rasterize-svg", json={"svg": unsafe_svg})

    assert response.status_code == 400
    assert called is False

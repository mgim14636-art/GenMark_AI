"""브랜드킷(F14) 계약 테스트.

백엔드는 이 응답 형태에 맞춰 brand_kits 테이블에 저장하므로, 키 이름과 규격이
바뀌면 연동이 조용히 깨진다. 규격 자체를 테스트로 고정한다.
"""
import base64
from io import BytesIO
import xml.etree.ElementTree as ET

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _stub_ai_product_scene(monkeypatch):
    """제품 썸네일의 AI 제품 사진 호출이 실제 OpenRouter 네트워크를 타지 않게 한다."""
    from app.services import logo_gen_service

    def fake_call_image_api(prompt, seed=None, model=None):
        return Image.new("RGB", (1024, 1024), (210, 220, 230)), None

    monkeypatch.setattr(logo_gen_service, "_call_image_api", fake_call_image_api)


def _logo_b64(size=(400, 400)) -> str:
    """흰 배경 + 가운데 도형 — /generate가 내보내는 로고와 같은 형태."""
    img = Image.new("RGB", size, (255, 255, 255))
    from PIL import ImageDraw

    ImageDraw.Draw(img).ellipse(
        [size[0] * 0.25, size[1] * 0.25, size[0] * 0.75, size[1] * 0.75],
        fill=(79, 70, 229),
    )
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def _decode(payload: dict) -> Image.Image:
    return Image.open(BytesIO(base64.b64decode(payload["imageBase64"])))


def test_business_card_returns_print_sized_image():
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "BUSINESS_CARD",
            "logo_image_base64": _logo_b64(),
            "ci_bi": "CI",
            "survey": {"company_name": "젠마크", "tone": "friendly", "colors": ["#4F46E5"]},
            "card_info": {
                "name": "남현욱",
                "title": "대표",
                "phone": "010-1234-5678",
                "email": "hello@genmark.ai",
            },
        },
    )

    assert response.status_code == 200
    assert len(response.json()["images"]) == 2
    body = response.json()
    assert body["kitType"] == "BUSINESS_CARD"
    assert body["preliminary"] is False  # 명함은 외부 API 없이 최종 품질까지 합성된다
    image = body["images"][0]
    # 규격은 렌더러(business_card.CardLayout)를 따른다. 숫자를 여기에 박아두면
    # 레이아웃을 조정할 때마다 무관한 테스트가 깨진다.
    from app.schemas.brand_kit import KIT_SIZE
    assert (image["width"], image["height"]) == KIT_SIZE["BUSINESS_CARD"]
    assert _decode(image).size == KIT_SIZE["BUSINESS_CARD"]


def test_business_card_returns_svg_and_pdf_print_assets():
    logo_svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10H90V90H10Z" fill="#4f46e5"/></svg>"""
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "BUSINESS_CARD",
            "logo_image_base64": _logo_b64(),
            "logo_svg": logo_svg,
            "survey": {"company_name": "GenMark"},
            "card_info": {"name": "Kim", "email": "kim@example.com"},
        },
    )

    assert response.status_code == 200
    for image in response.json()["images"]:
        svg = base64.b64decode(image["svgBase64"])
        pdf = base64.b64decode(image["pdfBase64"])
        root = ET.fromstring(svg)
        assert root.tag.endswith("svg")
        assert root.attrib["width"] == "87.5mm"
        assert root.attrib["height"] == "50mm"
        assert root.attrib.get("preserveAspectRatio") != "none"
        assert any(element.tag.endswith("path") for element in root.iter())
        assert b"data:image/png" not in svg
        assert pdf.startswith(b"%PDF-")


def test_business_card_print_assets_fall_back_to_embedded_png_logo():
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "BUSINESS_CARD",
            "logo_image_base64": _logo_b64(),
            "survey": {},
            "card_info": {"name": "Kim"},
        },
    )

    assert response.status_code == 200
    svg = base64.b64decode(response.json()["images"][0]["svgBase64"])
    assert b"data:image/png;base64," in svg
    assert base64.b64decode(response.json()["images"][0]["pdfBase64"]).startswith(b"%PDF-")


def test_response_exposes_top_level_image_base64():
    """백엔드 FastApiBrandKitAiClient가 응답 최상위 imageBase64를 읽는다.

    images[]만 내보내면 AI_INVALID_RESPONSE로 떨어지므로 두 자리를 함께 채운다.
    """
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={"kit_type": "BUSINESS_CARD", "logo_image_base64": _logo_b64(), "survey": {}},
    )

    body = response.json()
    assert isinstance(body["imageBase64"], str) and body["imageBase64"]
    assert body["imageBase64"] == body["images"][0]["imageBase64"]


def test_business_card_without_card_info_degrades_instead_of_failing():
    """백엔드 BrandKitProcessor는 현재 card_info를 보내지 않는다.

    400을 내면 CI 브랜드킷이 전부 FAILED로 끝나므로, 회사명만 넣은 카드로 합성하고
    preliminary와 warnings로 미완성임을 알린다.
    """
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "BUSINESS_CARD",
            "logo_image_base64": _logo_b64(),
            "ci_bi": "CI",
            "survey": {"company_name": "젠마크", "color_manual": ["#4F46E5"]},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["preliminary"] is True
    assert any("card_info" in w for w in body["warnings"])
    from app.schemas.brand_kit import KIT_SIZE
    assert body["images"][0]["width"] == KIT_SIZE["BUSINESS_CARD"][0]


def test_backend_minimal_request_shape_is_accepted():
    """BrandKitProcessor.buildRequest가 실제로 보내는 4개 키만으로 동작해야 한다."""
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "BOTTLE",
            "logo_image_base64": _logo_b64(),
            "survey": {
                "ci_bi": "BI",
                "company_name": "젠마크",
                "industry": "COSMETICS",
                "company_values_text": "신뢰, 혁신",
                "tone": "friendly",
                "color_mode": "MANUAL",
                "color_manual": ["#4F46E5", "#EC4899"],
                "style": "combination",
                "additional_requirements": None,
                "num_variants": 4,
            },
            "ci_bi": "BI",
        },
    )

    assert response.status_code == 200
    assert response.json()["images"][0]["width"] == 1000


def test_product_thumbnail_is_1000x1000_and_uses_ai_product_scene():
    """AI 제품 사진 생성이 성공하면 임시 결과 표시 없이 1000x1000 이미지를 낸다."""
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "PRODUCT_THUMBNAIL",
            "logo_image_base64": _logo_b64(),
            "ci_bi": "BI",
            "survey": {"brand_name": "젠마크", "colors": ["#EC4899"]},
            "product_name": "수분 세럼",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["kitType"] == "PRODUCT_THUMBNAIL"
    assert body["preliminary"] is False
    assert body["warnings"] == []
    image = body["images"][0]
    assert (image["width"], image["height"]) == (1000, 1000)


def test_product_thumbnail_falls_back_to_gradient_when_ai_generation_fails(monkeypatch):
    """AI 배경 생성이 실패해도(키 미설정·네트워크 오류 등) 200으로 응답하고
    preliminary=True로 대체 사실을 알린다."""
    from app.services import logo_gen_service

    def failing_call(prompt, seed=None, model=None):
        raise RuntimeError("OpenRouter API 오류 (500): boom")

    monkeypatch.setattr(logo_gen_service, "_call_image_api", failing_call)

    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "PRODUCT_THUMBNAIL",
            "logo_image_base64": _logo_b64(),
            "ci_bi": "BI",
            "survey": {"brand_name": "젠마크", "colors": ["#EC4899"]},
            "product_name": "수분 세럼",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["preliminary"] is True
    assert any("AI 제품 사진" in w for w in body["warnings"])
    image = body["images"][0]
    assert (image["width"], image["height"]) == (1000, 1000)


def test_bottle_is_accepted_as_thumbnail_alias():
    """백엔드 요청서의 최초 표기(BOTTLE)로도 계속 호출할 수 있어야 한다."""
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "BOTTLE",
            "logo_image_base64": _logo_b64(),
            "survey": {},
        },
    )

    assert response.status_code == 200
    assert response.json()["kitType"] == "PRODUCT_THUMBNAIL"


def test_invalid_base64_returns_400_without_echoing_input():
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "PRODUCT_THUMBNAIL",
            "logo_image_base64": "not-a-real-base64!!!",
            "survey": {},
        },
    )

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == "BRANDKIT_INVALID_IMAGE"
    assert "not-a-real-base64" not in str(body)  # 입력값이 응답에 되비치지 않아야 한다


def test_unknown_kit_type_is_rejected():
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={"kit_type": "POSTER", "logo_image_base64": _logo_b64(), "survey": {}},
    )

    assert response.status_code == 422

"""브랜드킷(F14) 계약 테스트.

백엔드는 이 응답 형태에 맞춰 brand_kits 테이블에 저장하므로, 키 이름과 규격이
바뀌면 연동이 조용히 깨진다. 규격 자체를 테스트로 고정한다.
"""
import base64
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


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
    body = response.json()
    assert body["kitType"] == "BUSINESS_CARD"
    assert body["preliminary"] is False  # 명함은 외부 API 없이 최종 품질까지 합성된다
    image = body["images"][0]
    assert (image["width"], image["height"]) == (1063, 591)  # 90x50mm @300dpi
    assert _decode(image).size == (1063, 591)


def test_business_card_requires_card_info():
    response = client.post(
        "/api/v1/generation/brand-kit",
        json={
            "kit_type": "BUSINESS_CARD",
            "logo_image_base64": _logo_b64(),
            "survey": {},
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == "BRANDKIT_MISSING_CARD_INFO"


def test_product_thumbnail_is_1000x1000_and_flagged_preliminary():
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
    # FLUX 연출 배경이 붙기 전까지는 임시 결과임을 백엔드가 구분할 수 있어야 한다
    assert body["preliminary"] is True
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

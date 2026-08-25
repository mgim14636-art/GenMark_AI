"""유사도 API 계약 테스트 (백엔드 요구사항 §15).

모델·데이터 없이도 계약을 검증할 수 있도록 DINOv2 추론과 FAISS 검색을 대체한다.
실제 데이터로 도는 통합 테스트는 test_similarity_integration.py에 둔다.
"""
import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core import readiness
from app.core.readiness import Readiness
from app.main import app
from app.services import similarity_service as svc
from app.services.similarity_service import (
    SimilarityService,
    _risk_level,
    _to_score,
)

client = TestClient(app, raise_server_exceptions=False)


# --------------------------------------------------------------------------
# 헬퍼
# --------------------------------------------------------------------------
def png_base64(size=(64, 64), color=(200, 120, 60)) -> str:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def fake_meta(app_no: str, path: str) -> dict:
    return {
        "출원번호": app_no,
        "상표한글명": "테스트상표",
        "상표영문명": "TESTMARK",
        "상표구분코드명": "도형복합",
        "류": "03",
        "이미지경로": path,
    }


@pytest.fixture
def ready(monkeypatch):
    """검색 준비 완료 상태로 고정한다."""
    state = Readiness(
        ready=True, record_count=7423, metadata_count=7423, embedding_dimension=768
    )
    monkeypatch.setattr(readiness, "_state", state)
    monkeypatch.setattr("app.api.routes.similarity.get_state", lambda *a, **k: state)
    monkeypatch.setattr("app.api.routes.health.get_state", lambda *a, **k: state)
    return state


@pytest.fixture
def stub_search(monkeypatch):
    """DINOv2 + FAISS를 대체해 코사인 유사도를 직접 주입한다.

    점수는 코사인으로 계산되므로 테스트도 코사인을 넣는다.
    (z는 하위 호환을 위해 남겨두지만 점수 산출에는 쓰이지 않는다.)
    """

    def _apply(coss):
        monkeypatch.setattr(
            "app.services.similarity_service.DinoService.extract_features",
            lambda src: [0.0] * 768,
        )
        monkeypatch.setattr(
            "app.services.similarity_service.FaissService.search_similar",
            lambda vector, top_k=3: [
                {
                    "index": i,
                    "cos": cos,
                    "z": 0.0,
                    "meta": fake_meta(
                        f"402022012640{i}", f"raw/IMG/402022012640{i}_tm000001.jpg"
                    ),
                }
                for i, cos in enumerate(coss[:top_k])
            ],
        )

    return _apply


# --------------------------------------------------------------------------
# 점수 · 위험도 (§15 단위 테스트)
# --------------------------------------------------------------------------
def test_score_is_clamped_to_0_100():
    """입력은 코사인 유사도. 앵커 범위 밖은 clamp 된다."""
    assert _to_score(-1.0) == 0         # 하한 밖
    assert _to_score(0.42) == 0         # 첫 앵커
    assert _to_score(1.0) == 100        # 상한
    assert _to_score(2.0) == 100        # 이론상 불가하지만 방어
    assert 0 <= _to_score(0.67) <= 100


def test_score_is_int():
    assert isinstance(_to_score(0.85), int)


def test_score_rejects_nan_and_inf():
    assert _to_score(float("nan")) == 0
    assert _to_score(float("inf")) == 100
    assert _to_score(float("-inf")) == 0


def test_model_load_failure_returns_503(ready, monkeypatch):
    """모델 로딩 실패는 503. 단, 입력 검증(400)보다 뒤에 판정돼야 한다."""
    monkeypatch.setattr(
        "app.models.dino_model.dino_loader.load_model",
        lambda: (_ for _ in ()).throw(RuntimeError("weights unavailable")),
    )
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 3},
    )
    assert res.status_code == 503
    assert res.json()["code"] == "SIMILARITY_MODEL_NOT_READY"


@pytest.mark.parametrize(
    "score,expected",
    [
        (0, "SAFE"),
        (29, "SAFE"),
        (30, "MODERATE"),
        (59, "MODERATE"),
        (60, "CAUTION"),
        (100, "CAUTION"),
    ],
)
def test_risk_level_boundaries(score, expected):
    """경계값 29/30/59/60"""
    assert _risk_level(score) == expected


def test_score_cosine_anchors():
    """실측 앵커가 유지되는지 확인 (scripts/calibrate_score.py 기준)"""
    assert _to_score(0.80) == 30    # 생성 로고 p95 → SAFE 상한
    assert _to_score(0.89) == 60    # 등록 상표 최근접 중앙값 → CAUTION 진입
    assert _to_score(1.00) == 100   # 사실상 동일


def test_score_is_monotonic_in_cosine():
    """코사인이 커지면 점수도 반드시 커져야 한다.

    z 정규화를 쓰던 시절에는 이 성질이 깨져서 동일 이미지(cos=1.0)가
    무관한 로고보다 낮은 점수를 받는 역전이 있었다.
    """
    xs = [0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.89, 0.95, 1.0]
    scores = [_to_score(x) for x in xs]
    assert scores == sorted(scores)
    assert scores[0] < scores[-1]


def test_generated_logo_range_is_safe():
    """실측된 생성 로고(심볼·혼합형) 코사인 구간은 SAFE 여야 한다."""
    for cos in (0.52, 0.59, 0.67, 0.78):
        assert _to_score(cos) < 30


# --------------------------------------------------------------------------
# 응답 계약 (§11)
# --------------------------------------------------------------------------
def test_search_returns_exactly_topk(ready, stub_search):
    stub_search([0.95, 0.85, 0.75, 0.65])
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "logoStyle": "combination", "topK": 3},
    )
    assert res.status_code == 200
    assert len(res.json()["matches"]) == 3


def test_response_contract_fields(ready, stub_search):
    stub_search([0.95, 0.85, 0.75])
    body = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "logoStyle": "combination", "topK": 3},
    ).json()

    assert set(body) == {"maxSimilarity", "riskLevel", "matches", "disclaimer"}
    assert body["riskLevel"] in {"SAFE", "MODERATE", "CAUTION"}
    assert 0 <= body["maxSimilarity"] <= 100
    assert body["disclaimer"].strip()

    for i, m in enumerate(body["matches"], 1):
        assert m["rank"] == i                       # rank는 1부터 순차 증가
        assert 0 <= m["similarity"] <= 100
        assert m["applicationNumber"].strip()       # 빈 문자열 금지
        assert m["name"].strip()
        assert m["category"].strip()
        assert m["imagePath"].strip()
        assert not m["imagePath"].startswith(("/", "C:", "\\"))  # 상대경로만


def test_matches_sorted_desc_and_max_matches_first(ready, stub_search):
    stub_search([0.75, 0.95, 0.85])  # 일부러 뒤섞어 주입
    body = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 3},
    ).json()

    scores = [m["similarity"] for m in body["matches"]]
    assert scores == sorted(scores, reverse=True)
    assert body["maxSimilarity"] == scores[0]


def test_category_is_never_empty_when_metadata_partial(ready, monkeypatch):
    monkeypatch.setattr(
        "app.services.similarity_service.DinoService.extract_features",
        lambda src: [0.0] * 768,
    )
    monkeypatch.setattr(
        "app.services.similarity_service.FaissService.search_similar",
        lambda vector, top_k=3: [
            {
                "index": 0,
                "cos": 0.9,
                "z": 3.0,
                "meta": {
                    "출원번호": "4020220126402",
                    "이미지경로": "raw/IMG/a.jpg",
                    # 이름·류·구분 전부 없음
                },
            }
        ],
    )
    body = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 1},
    ).json()
    m = body["matches"][0]
    assert m["name"].strip() and m["category"].strip()


# --------------------------------------------------------------------------
# 오류 응답 (§12)
# --------------------------------------------------------------------------
def test_missing_required_field_returns_422(ready):
    res = client.post("/api/v1/similarity/search", json={"logoStyle": "combination"})
    assert res.status_code == 422
    assert res.json()["code"] == "SIMILARITY_INVALID_REQUEST"


def test_invalid_topk_returns_422(ready):
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 0},
    )
    assert res.status_code == 422


def test_text_only_logo_style_is_rejected(ready):
    """워드마크·레터마크는 도형이 없어 도형복합 DB로 판정할 수 없다.

    실측에서 top-1 코사인 중앙값이 워드마크 0.94 / 레터마크 0.93 으로,
    등록 상표 간 최근접 중앙값(0.89)보다 높게 나오는 오탐이 확인됐다.
    """
    for style in ("wordmark", "lettermark", "텍스트"):
        res = client.post(
            "/api/v1/similarity/search",
            json={"imageBase64": png_base64(), "logoStyle": style, "topK": 3},
        )
        assert res.status_code == 422, style
        assert res.json()["code"] == "SIMILARITY_INVALID_REQUEST"


def test_graphic_logo_styles_are_accepted(ready, stub_search):
    stub_search([0.9, 0.8, 0.7])
    for style in ("combination", "symbol"):
        res = client.post(
            "/api/v1/similarity/search",
            json={"imageBase64": png_base64(), "logoStyle": style, "topK": 3},
        )
        assert res.status_code == 200, style


def test_snake_case_request_is_rejected(ready):
    """계약은 camelCase. 예전 snake_case 요청은 통과하면 안 된다."""
    res = client.post(
        "/api/v1/similarity/search", json={"image_url": "test.png", "top_k": 3}
    )
    assert res.status_code == 422


def test_invalid_base64_returns_400(ready):
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": "!!!not-base64!!!" * 40, "topK": 3},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "SIMILARITY_INVALID_BASE64"


def test_non_image_payload_returns_400(ready):
    payload = base64.b64encode(b"x" * 2000).decode()
    res = client.post(
        "/api/v1/similarity/search", json={"imageBase64": payload, "topK": 3}
    )
    assert res.status_code == 400
    assert res.json()["code"] == "SIMILARITY_UNSUPPORTED_IMAGE"


def test_tiny_image_returns_400(ready):
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(size=(2, 2)), "topK": 3},
    )
    assert res.status_code == 400
    assert res.json()["code"] == "SIMILARITY_UNSUPPORTED_IMAGE"


def test_base64_is_not_echoed_in_error_body(ready):
    """계약: Base64 원문을 노출하지 않는다."""
    payload = png_base64(size=(2, 2))
    res = client.post(
        "/api/v1/similarity/search", json={"imageBase64": payload, "topK": 3}
    )
    assert payload[:64] not in res.text


def test_not_ready_returns_503_not_fake_200(monkeypatch):
    """데이터가 없을 때 가짜 성공(200 + 빈 matches)을 내면 안 된다."""
    state = Readiness(ready=False, reason="Embedding and metadata counts do not match.")
    monkeypatch.setattr("app.api.routes.similarity.get_state", lambda *a, **k: state)

    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 3},
    )
    assert res.status_code == 503
    assert res.json()["code"] == "SIMILARITY_DATA_NOT_READY"
    assert "matches" not in res.json()


def test_empty_faiss_result_returns_503(ready, monkeypatch):
    """인덱스가 비어 빈 결과가 나와도 200으로 내보내지 않는다."""
    monkeypatch.setattr(
        "app.services.similarity_service.DinoService.extract_features",
        lambda src: [0.0] * 768,
    )
    monkeypatch.setattr(
        "app.services.similarity_service.FaissService.search_similar",
        lambda vector, top_k=3: [],
    )
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 3},
    )
    assert res.status_code == 503


# --------------------------------------------------------------------------
# Health (§13)
# --------------------------------------------------------------------------
def test_health_ready(ready):
    body = client.get("/health").json()
    assert body["status"] == "ready"
    assert body["recordCount"] == 7423
    assert body["metadataCount"] == 7423
    assert body["embeddingDimension"] == 768
    assert body["modelId"] == "facebook/dinov2-base"


def test_health_not_ready_returns_503(monkeypatch):
    state = Readiness(ready=False, reason="Required data files are missing.")
    monkeypatch.setattr("app.api.routes.health.get_state", lambda *a, **k: state)
    res = client.get("/health")
    assert res.status_code == 503
    assert res.json()["status"] == "not_ready"
    assert res.json()["reason"]


def test_health_never_reports_plain_ok(monkeypatch):
    """프로세스가 떴다는 이유만으로 status=ok를 내면 안 된다."""
    state = Readiness(ready=False, reason="x")
    monkeypatch.setattr("app.api.routes.health.get_state", lambda *a, **k: state)
    assert client.get("/health").json()["status"] != "ok"


# --------------------------------------------------------------------------
# note (Gemini 설명) — 부가 정보이므로 실패해도 응답은 정상이어야 한다
# --------------------------------------------------------------------------
def test_note_is_attached_when_available(ready, stub_search, monkeypatch):
    stub_search([0.95, 0.85, 0.75])
    monkeypatch.setattr("app.services.note_service.is_enabled", lambda: True)
    monkeypatch.setattr(
        "app.services.note_service.generate_notes",
        lambda query, paths: ["방패 외곽선이 닮았어요", "곡선 흐름이 비슷해요", None],
    )
    body = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 3},
    ).json()

    assert body["matches"][0]["note"] == "방패 외곽선이 닮았어요"
    assert body["matches"][1]["note"] == "곡선 흐름이 비슷해요"
    assert body["matches"][2]["note"] is None   # 일부만 생성돼도 정상


def test_note_failure_does_not_break_response(ready, stub_search, monkeypatch):
    """Gemini가 죽어도 유사도 결과는 그대로 나가야 한다."""
    stub_search([0.95, 0.85, 0.75])
    monkeypatch.setattr("app.services.note_service.is_enabled", lambda: True)
    monkeypatch.setattr(
        "app.services.note_service.generate_notes",
        lambda query, paths: (_ for _ in ()).throw(RuntimeError("gemini down")),
    )
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 3},
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["matches"]) == 3
    assert body["maxSimilarity"] == body["matches"][0]["similarity"]
    assert all(m["note"] is None for m in body["matches"])


def test_note_omitted_when_api_key_missing(ready, stub_search, monkeypatch):
    stub_search([0.95, 0.85, 0.75])
    monkeypatch.setattr("app.services.note_service.is_enabled", lambda: False)
    body = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "topK": 3},
    ).json()
    assert all(m["note"] is None for m in body["matches"])


def test_note_content_filter_drops_legal_judgement():
    """LLM이 법적 판단을 뱉으면 서버가 버려야 한다."""
    from app.services.note_service import _sanitize

    assert _sanitize("방패 형태와 중앙 분할이 닮았어요") == "방패 형태와 중앙 분할이 닮았어요"
    assert _sanitize("상표권 침해 소지가 있어 보여요") is None
    assert _sanitize("이대로는 등록 가능성이 낮아요") is None
    assert _sanitize("거절될 수 있어요") is None
    assert _sanitize("") is None
    assert _sanitize(None) is None
    assert _sanitize(123) is None


def test_note_is_truncated():
    from app.services.note_service import MAX_NOTE_CHARS, _sanitize

    long_note = "곡" * 200
    assert len(_sanitize(long_note)) == MAX_NOTE_CHARS


def test_note_rejects_truncated_json_fragments():
    """응답이 잘려 JSON 파편이 흘러들면 note를 버려야 한다.

    실제로 ': 전체적인 방패 모양', '["곡선 형태의...' 같은 파편이
    사용자에게 노출된 적이 있다. maxOutputTokens 부족 + 관대한 폴백 파서 조합이 원인.
    """
    from app.services.note_service import _sanitize

    for junk in (
        ": 전체적인 방패 모양 테두리 형태",
        '["곡선 형태의 문자 모노그램 요소 외',
        "```json",
        "}",
        ",",
    ):
        assert _sanitize(junk) is None, junk


def test_note_rejects_english_instruction_echo():
    """지시문이 영어로 새어나오는 경우를 차단한다."""
    from app.services.note_service import _sanitize

    assert _sanitize("Under 40 characters per") is None
    assert _sanitize("Describe the shape similarity") is None
    assert _sanitize("방패 외곽선이 닮았어요") is not None


def test_note_parser_has_no_line_fallback():
    """잘린 JSON을 줄 단위로 억지 파싱하지 않는다."""
    from app.services.note_service import _parse_notes

    assert _parse_notes('["곡선 형태의 문자') is None
    assert _parse_notes("설명을 드리자면 다음과 같습니다") is None
    # 정상 JSON은 그대로 통과
    assert _parse_notes('["가나다라마", "바사아자차"]') == ["가나다라마", "바사아자차"]


# --- note 제공자 전환 -----------------------------------------------------
# 로고 생성이 OpenRouter로 통합되면서 note도 같은 키로 쓸 수 있게 됐다.
# 두 경로를 오갈 수 있어야 하므로(무료 등급 429가 서로 독립) 분기를 고정한다.

def test_note_provider_defaults_to_openrouter_when_key_present(monkeypatch):
    from app.services import note_service

    monkeypatch.delenv("NOTE_PROVIDER", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    assert note_service._provider() == "openrouter"
    assert note_service._api_key() == "sk-test"


def test_openrouter_note_model_defaults_to_gemini_flash_lite(monkeypatch):
    from app.services import note_service

    monkeypatch.setenv("NOTE_PROVIDER", "openrouter")
    monkeypatch.delenv("NOTE_MODEL", raising=False)

    assert note_service._model() == "google/gemini-2.5-flash-lite"


def test_note_provider_falls_back_to_gemini_without_openrouter_key(monkeypatch):
    from app.services import note_service

    monkeypatch.delenv("NOTE_PROVIDER", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("GEMINI_API_KEY", "gem-test")
    assert note_service._provider() == "gemini"
    assert note_service._api_key() == "gem-test"


def test_note_provider_respects_explicit_setting(monkeypatch):
    from app.services import note_service

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    monkeypatch.setenv("GEMINI_API_KEY", "gem-test")
    monkeypatch.setenv("NOTE_PROVIDER", "gemini")
    assert note_service._provider() == "gemini"


def test_openrouter_request_carries_images_as_data_uri(monkeypatch):
    """이미지가 OpenAI 호환 형식(image_url + data URI)으로 실려야 한다.

    Gemini의 inline_data 형식을 그대로 보내면 모델이 이미지를 못 본 채
    그럴듯한 설명을 지어낸다 — 실패가 눈에 띄지 않는 종류라 계약으로 고정한다.
    """
    from app.services import note_service

    monkeypatch.setenv("NOTE_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    note_service._quota_blocked_until = 0.0
    sent = {}

    class _Res:
        status_code = 200
        ok = True

        @staticmethod
        def json():
            return {"choices": [{"message": {"content": '["원형 윤곽이 닮았어요"]'},
                                 "finish_reason": "stop"}]}

    def fake_post(url, **kwargs):
        sent["url"] = url
        sent["json"] = kwargs.get("json")
        return _Res()

    monkeypatch.setattr(note_service.requests, "post", fake_post)

    out = note_service._call_openrouter(["QkFTRTY0", "QkFTRTY0Mg=="])
    assert out == '["원형 윤곽이 닮았어요"]'
    assert sent["url"] == note_service.OPENROUTER_URL

    content = sent["json"]["messages"][0]["content"]
    images = [c for c in content if c.get("type") == "image_url"]
    assert len(images) == 2
    assert images[0]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert any(c.get("type") == "text" for c in content)


# --------------------------------------------------------------------------
# generate_pair_note — 관리자 유사도 테스트 도구의 임의 두 이미지 1:1 설명
# --------------------------------------------------------------------------

def _tiny_png_bytes() -> bytes:
    from io import BytesIO

    from PIL import Image

    buf = BytesIO()
    Image.new("RGB", (4, 4), (255, 255, 255)).save(buf, format="PNG")
    return buf.getvalue()


def test_generate_pair_note_returns_none_when_disabled(monkeypatch):
    from app.services import note_service

    monkeypatch.setattr(note_service, "is_enabled", lambda: False)
    assert note_service.generate_pair_note(_tiny_png_bytes(), _tiny_png_bytes()) is None


def test_generate_pair_note_sends_both_images_and_sanitizes_result(monkeypatch):
    from app.services import note_service

    monkeypatch.setenv("NOTE_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    note_service._quota_blocked_until = 0.0
    sent = {}

    class _Res:
        status_code = 200
        ok = True

        @staticmethod
        def json():
            return {"choices": [{"message": {"content": "원형 배치와 곡선 중심의 실루엣에서 일부 비슷한 요소를 발견했어요."},
                                 "finish_reason": "stop"}]}

    def fake_post(url, **kwargs):
        sent["url"] = url
        sent["json"] = kwargs.get("json")
        return _Res()

    monkeypatch.setattr(note_service.requests, "post", fake_post)

    note = note_service.generate_pair_note(_tiny_png_bytes(), _tiny_png_bytes())

    assert note == "원형 배치와 곡선 중심의 실루엣에서 일부 비슷한 요소를 발견했어요."
    assert sent["url"] == note_service.OPENROUTER_URL
    images = [c for c in sent["json"]["messages"][0]["content"] if c.get("type") == "image_url"]
    assert len(images) == 2


def test_generate_pair_note_drops_legal_wording(monkeypatch):
    from app.services import note_service

    monkeypatch.setenv("NOTE_PROVIDER", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test")
    note_service._quota_blocked_until = 0.0

    class _Res:
        status_code = 200
        ok = True

        @staticmethod
        def json():
            return {"choices": [{"message": {"content": "상표권 침해 소지가 있어 보여요"}, "finish_reason": "stop"}]}

    monkeypatch.setattr(note_service.requests, "post", lambda url, **kwargs: _Res())

    assert note_service.generate_pair_note(_tiny_png_bytes(), _tiny_png_bytes()) is None

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
    """DINOv2 + FAISS를 대체해 z값을 직접 주입한다."""

    def _apply(zs):
        monkeypatch.setattr(
            "app.services.similarity_service.DinoService.extract_features",
            lambda src: [0.0] * 768,
        )
        monkeypatch.setattr(
            "app.services.similarity_service.FaissService.search_similar",
            lambda vector, top_k=3: [
                {
                    "index": i,
                    "cos": 0.9,
                    "z": z,
                    "meta": fake_meta(
                        f"402022012640{i}", f"raw/IMG/402022012640{i}_tm000001.jpg"
                    ),
                }
                for i, z in enumerate(zs[:top_k])
            ],
        )

    return _apply


# --------------------------------------------------------------------------
# 점수 · 위험도 (§15 단위 테스트)
# --------------------------------------------------------------------------
def test_score_is_clamped_to_0_100():
    assert _to_score(-99) == 0          # 음수 → 0
    assert _to_score(0) == 0            # 13.7*0 - 7.3 = -7.3 → 0
    assert _to_score(1e6) == 100        # 상한
    assert 0 <= _to_score(2.72) <= 100


def test_score_is_int():
    assert isinstance(_to_score(3.5), int)


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


def test_score_formula_anchors():
    """등록 상표 z 분포 앵커링이 유지되는지 확인 (13.7z - 7.3)"""
    assert _to_score(2.72) == 30   # 중앙값 → SAFE/MODERATE 경계
    assert _to_score(4.91) == 60   # 상위 5% → MODERATE/CAUTION 경계


# --------------------------------------------------------------------------
# 응답 계약 (§11)
# --------------------------------------------------------------------------
def test_search_returns_exactly_topk(ready, stub_search):
    stub_search([5.0, 4.0, 3.0, 2.0])
    res = client.post(
        "/api/v1/similarity/search",
        json={"imageBase64": png_base64(), "logoStyle": "combination", "topK": 3},
    )
    assert res.status_code == 200
    assert len(res.json()["matches"]) == 3


def test_response_contract_fields(ready, stub_search):
    stub_search([5.0, 4.0, 3.0])
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
    stub_search([3.0, 5.0, 4.0])  # 일부러 뒤섞어 주입
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

"""자체 생성 로고 벡터 저장소(관리자 전용) 계약 테스트.

KIPRIS 인덱스(test_similarity.py)와 완전히 분리된 별도 저장소이므로, 여기서는
쓰기 가능한 임시 경로에 대해서만 검증한다. 실제 DINOv2 추론은 스텁으로 대체한다.
"""
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.generation_vector_service import GenerationVectorService

client = TestClient(app, raise_server_exceptions=False)


def vector(first: float) -> list[float]:
    return [first] + [0.0] * (settings.embedding_dimension - 1)


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    """실제 generation-data 파일을 건드리지 않도록 임시 경로로 돌린다."""
    monkeypatch.setattr(settings, "generation_embeddings_path", str(tmp_path / "embeddings.npy"))
    monkeypatch.setattr(settings, "generation_ids_path", str(tmp_path / "ids.csv"))


def test_register_creates_files_and_returns_count(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )

    total = GenerationVectorService.register("base64-image", "candidate-1")

    assert total == 1
    assert np.load(settings.generation_embeddings_path).shape == (1, settings.embedding_dimension)


def test_register_is_idempotent_for_same_id(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )

    first = GenerationVectorService.register("base64-image", "candidate-1")
    second = GenerationVectorService.register("base64-image", "candidate-1")

    assert first == 1
    assert second == 1
    assert np.load(settings.generation_embeddings_path).shape == (1, settings.embedding_dimension)


def test_register_appends_second_distinct_id(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )

    GenerationVectorService.register("base64-image", "candidate-1")
    total = GenerationVectorService.register("base64-image", "candidate-2")

    assert total == 2


def test_compare_by_id_returns_high_score_for_identical_vectors(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )
    GenerationVectorService.register("base64-image", "candidate-1")

    result = GenerationVectorService.compare_by_id("candidate-1", "base64-comparison")

    assert result["similarity"] == 100
    assert result["riskLevel"] == "CAUTION"
    assert "상표 등록 가능 여부" in result["disclaimer"]


def test_compare_by_id_without_vector_image_skips_note(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )
    called = []
    monkeypatch.setattr(
        "app.services.generation_vector_service.note_service.generate_pair_note",
        lambda a, b: called.append((a, b)) or "should not be used",
    )
    GenerationVectorService.register("base64-image", "candidate-1")

    result = GenerationVectorService.compare_by_id("candidate-1", "base64-comparison")

    assert result["note"] is None
    assert called == []


def test_compare_by_id_with_vector_image_includes_note(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.to_bytes",
        lambda src: src.encode(),
    )
    monkeypatch.setattr(
        "app.services.generation_vector_service.note_service.generate_pair_note",
        lambda a, b: "원형 배치와 곡선 중심의 실루엣에서 일부 비슷한 요소를 발견했어요.",
    )
    GenerationVectorService.register("base64-image", "candidate-1")

    result = GenerationVectorService.compare_by_id("candidate-1", "base64-comparison", "base64-vector-image")

    assert result["note"] == "원형 배치와 곡선 중심의 실루엣에서 일부 비슷한 요소를 발견했어요."


def test_compare_by_id_raises_for_unknown_id(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )

    with pytest.raises(ValueError):
        GenerationVectorService.compare_by_id("missing", "base64-comparison")


def test_register_route_returns_total_count(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )

    response = client.post(
        "/api/v1/generation-vectors/register",
        json={"image_url": "base64-image", "id": "candidate-1"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body == {"id": "candidate-1", "totalCount": 1}


def test_compare_route_returns_404_for_unknown_id(monkeypatch):
    monkeypatch.setattr(
        "app.services.generation_vector_service.DinoService.extract_features",
        lambda src: vector(1.0),
    )

    response = client.post(
        "/api/v1/generation-vectors/compare",
        json={"id": "missing", "image_url": "base64-comparison"},
    )

    assert response.status_code == 404
    assert response.json()["code"] == "GENERATION_VECTOR_NOT_FOUND"

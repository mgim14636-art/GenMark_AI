from fastapi.testclient import TestClient

from app.main import app

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


def test_generation():
    response = client.post("/api/v1/generation/generate", json={"prompt": "test logo"})
    assert response.status_code == 200
    assert "image_url" in response.json()

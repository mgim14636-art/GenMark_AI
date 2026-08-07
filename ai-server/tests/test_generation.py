from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_generation():
    response = client.post(
        "/api/v1/generation/generate",
        json={"prompt": "test logo"}
    )
    assert response.status_code == 200
    assert "image_url" in response.json()

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_embedding():
    response = client.post(
        "/api/v1/embedding/extract",
        json={"image_url": "test.png"}
    )
    assert response.status_code == 200
    assert "vector" in response.json()
    assert response.json()["dimension"] == 384

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_similarity():
    response = client.post(
        "/api/v1/similarity/search",
        json={"image_url": "test.png", "top_k": 3}
    )
    assert response.status_code == 200
    assert "matches" in response.json()

import base64
import io

import pytest
import transformers
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app, raise_server_exceptions=False)

needs_model = pytest.mark.skipif(
    getattr(transformers, "IS_STUB", False),
    reason="transformers/torch not installed in this environment",
)


def png_base64(size=(64, 64)) -> str:
    buf = io.BytesIO()
    Image.new("RGB", size, (180, 90, 40)).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@needs_model
def test_embedding_returns_768_dim():
    """DINOv2-base의 CLS 벡터는 768차원이다. (계약 §6)"""
    response = client.post(
        "/api/v1/embedding/extract", json={"image_url": png_base64()}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["dimension"] == 768
    assert len(body["vector"]) == 768


def test_embedding_rejects_invalid_payload():
    response = client.post(
        "/api/v1/embedding/extract", json={"image_url": "!!!not-base64!!!" * 40}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "SIMILARITY_INVALID_BASE64"

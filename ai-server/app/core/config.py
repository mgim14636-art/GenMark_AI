import os
from pathlib import Path

from pydantic_settings import BaseSettings

# 로컬 실행(ai-server/ 기준)과 컨테이너 실행(/app 기준) 모두를 지원한다.
# 환경변수가 없으면 이 저장소 구조 기준 기본값을 쓴다.
_AI_SERVER_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_DATA_ROOT = _AI_SERVER_ROOT / "data"
_DEFAULT_GENERATION_DATA_ROOT = _AI_SERVER_ROOT / "generation-data"


class Settings(BaseSettings):
    app_name: str = "GenMark AI Server"
    fastapi_env: str = os.getenv("FASTAPI_ENV", "development")
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", 8000))
    huggingface_token: str = os.getenv("HUGGINGFACE_TOKEN", "")
    kipris_api_key: str = os.getenv("KIPRIS_API_KEY", "")

    # --- 유사도 검색 데이터 경로 (백엔드 요구사항 §10) ---
    embeddings_path: str = os.getenv(
        "EMBEDDINGS_PATH", str(_DEFAULT_DATA_ROOT / "faiss" / "embeddings.npy")
    )
    ids_path: str = os.getenv(
        "IDS_PATH", str(_DEFAULT_DATA_ROOT / "faiss" / "ids.csv")
    )
    data_manifest_path: str = os.getenv(
        "DATA_MANIFEST_PATH", str(_DEFAULT_DATA_ROOT / "faiss" / "data_manifest.json")
    )
    trademark_metadata_path: str = os.getenv(
        "TRADEMARK_METADATA_PATH",
        str(_DEFAULT_DATA_ROOT / "trademarks" / "meta" / "trademarks.csv"),
    )
    trademark_data_root: str = os.getenv(
        "TRADEMARK_DATA_ROOT", str(_DEFAULT_DATA_ROOT / "trademarks")
    )

    # --- 자체 생성 로고 벡터 저장소 (관리자 전용, KIPRIS 인덱스와 완전히 분리) ---
    # KIPRIS 데이터(위 embeddings_path 등)는 읽기전용으로 마운트되지만, 이 경로는
    # 쓰기 가능한 별도 볼륨(generation-data)에 마운트해 관리자가 벡터화한 로고를
    # 쌓아 나간다. 형식은 KIPRIS와 동일한 embeddings.npy + ids.csv.
    generation_embeddings_path: str = os.getenv(
        "GENERATION_EMBEDDINGS_PATH", str(_DEFAULT_GENERATION_DATA_ROOT / "embeddings.npy")
    )
    generation_ids_path: str = os.getenv(
        "GENERATION_IDS_PATH", str(_DEFAULT_GENERATION_DATA_ROOT / "ids.csv")
    )

    # --- 모델 ---
    model_id: str = os.getenv("DINO_MODEL_ID", "facebook/dinov2-base")
    # 재현성: Hugging Face revision을 고정한다. 비우면 main을 따라간다(비권장).
    model_revision: str = os.getenv("DINO_MODEL_REVISION", "f9e44c814b77203eaa57a6bdbbd535f21ede1415")
    embedding_dimension: int = 768

    class Config:
        extra = "ignore"
        env_file = ".env"


settings = Settings()

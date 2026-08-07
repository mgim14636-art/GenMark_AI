import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "GenMark AI Server"
    fastapi_env: str = os.getenv("FASTAPI_ENV", "development")
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", 8000))
    huggingface_token: str = os.getenv("HUGGINGFACE_TOKEN", "")
    faiss_index_path: str = os.getenv("FAISS_INDEX_PATH", "data/faiss/trademark.index")
    metadata_store_path: str = os.getenv("METADATA_STORE_PATH", "data/faiss/metadata.json")
    kipris_api_key: str = os.getenv("KIPRIS_API_KEY", "")

    class Config:
        extra = "ignore"
        env_file = ".env"

settings = Settings()

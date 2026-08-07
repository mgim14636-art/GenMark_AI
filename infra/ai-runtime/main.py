from fastapi import FastAPI

from app.api.routes.similarity import router as similarity_router
from app.core.config import settings

app = FastAPI(title=settings.app_name)
app.include_router(similarity_router, prefix="/api/v1/similarity", tags=["similarity"])


@app.get("/health")
def health():
    return {"status": "ok"}

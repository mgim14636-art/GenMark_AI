from fastapi import FastAPI
from app.api.routes import health, generation, embedding, similarity
from app.core.config import settings
from app.models.model_manager import ModelManager

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

@app.on_event("startup")
def startup_event():
    ModelManager.preload_all_models()

app.include_router(health.router, tags=["Health"])
app.include_router(generation.router, prefix="/api/v1/generation", tags=["Generation"])
app.include_router(embedding.router, prefix="/api/v1/embedding", tags=["Embedding"])
app.include_router(similarity.router, prefix="/api/v1/similarity", tags=["Similarity"])

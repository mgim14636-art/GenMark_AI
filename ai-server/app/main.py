from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import brand_kit, embedding, generation, health, similarity
from app.core.config import settings
from app.core.exceptions import CodedHTTPException, sanitize_validation_errors
from app.core.logging import logger
from app.core.readiness import get_state
from app.models.model_manager import ModelManager

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.on_event("startup")
def startup_event():
    ModelManager.preload_all_models()
    state = get_state(refresh=True)
    if not state.ready:
        logger.error("Startup validation failed: %s", state.reason)


@app.exception_handler(RequestValidationError)
def validation_error_handler(request: Request, exc: RequestValidationError):
    """계약: 필수 필드 누락·잘못된 topK → 422 + 안정적인 code"""
    return JSONResponse(
        status_code=422,
        content={
            "code": "SIMILARITY_INVALID_REQUEST",
            "message": "Request body does not match the required contract.",
            "details": sanitize_validation_errors(exc.errors()),
        },
    )


@app.exception_handler(CodedHTTPException)
def coded_error_handler(request: Request, exc: CodedHTTPException):
    """{"code": ..., "message": ...} 를 최상위로 내보낸다."""
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


app.include_router(health.router, tags=["Health"])
app.include_router(generation.router, prefix="/api/v1/generation", tags=["Generation"])
app.include_router(brand_kit.router, prefix="/api/v1/generation", tags=["Brand Kit"])
app.include_router(embedding.router, prefix="/api/v1/embedding", tags=["Embedding"])
app.include_router(similarity.router, prefix="/api/v1/similarity", tags=["Similarity"])

"""컨테이너 런타임 진입점.

Dockerfile.ai-similarity가 이 파일을 app/main.py 자리에 덮어쓴다.
따라서 여기에 등록하지 않은 라우터는 컨테이너에서 404가 된다.
로컬 실행(app/main.py)과 노출 라우트를 반드시 일치시킬 것.

/health는 app.core.readiness의 실제 준비 상태를 따른다.
"""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes.generation import router as generation_router
from app.api.routes.health import router as health_router
from app.api.routes.similarity import router as similarity_router
from app.core.config import settings
from app.core.exceptions import CodedHTTPException, sanitize_validation_errors
from app.core.logging import logger
from app.core.readiness import get_state

app = FastAPI(title=settings.app_name)
app.include_router(health_router, tags=["health"])
app.include_router(similarity_router, prefix="/api/v1/similarity", tags=["similarity"])
app.include_router(generation_router, prefix="/api/v1/generation", tags=["generation"])


@app.on_event("startup")
def startup_event():
    state = get_state(refresh=True)
    if not state.ready:
        # 서버는 뜨되, 준비되지 않았음을 명확히 남긴다. (/health가 503을 반환)
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

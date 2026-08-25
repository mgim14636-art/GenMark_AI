"""백엔드 계약용 에러 응답.

모든 에러는 원인을 구분할 수 있는 안정적인 `code`를 포함한다.
응답 본문 형식: {"code": "...", "message": "..."}
"""
from fastapi import HTTPException, status


def sanitize_validation_errors(errors: list[dict]) -> list[dict]:
    """검증 에러에서 원본 입력값을 제거한다.

    imageBase64가 그대로 응답·로그에 실리는 것을 막기 위함이다. (계약 §11)
    """
    safe = []
    for e in errors:
        safe.append({
            "loc": [str(x) for x in e.get("loc", [])],
            "type": e.get("type", ""),
            "msg": e.get("msg", ""),
        })
    return safe


class CodedHTTPException(HTTPException):
    """detail 자리에 {code, message}를 넣어 계약 형식을 맞춘다."""

    code: str = "INTERNAL_ERROR"
    status_code_default: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message_default: str = "Unexpected error."

    def __init__(self, message: str | None = None, status_code: int | None = None):
        super().__init__(
            status_code=status_code or self.status_code_default,
            detail={"code": self.code, "message": message or self.message_default},
        )


# --- 400: 요청 이미지 문제 ---------------------------------------------------
class InvalidBase64(CodedHTTPException):
    code = "SIMILARITY_INVALID_BASE64"
    status_code_default = status.HTTP_400_BAD_REQUEST
    message_default = "imageBase64 could not be decoded."


class UnsupportedImage(CodedHTTPException):
    code = "SIMILARITY_UNSUPPORTED_IMAGE"
    status_code_default = status.HTTP_400_BAD_REQUEST
    message_default = "Image format is not supported or the image is empty."


# --- 503: 서버 준비 안 됨 -----------------------------------------------------
class SimilarityDataNotReady(CodedHTTPException):
    code = "SIMILARITY_DATA_NOT_READY"
    status_code_default = status.HTTP_503_SERVICE_UNAVAILABLE
    message_default = "Trademark embeddings or metadata are not ready."


class ModelNotReady(CodedHTTPException):
    code = "SIMILARITY_MODEL_NOT_READY"
    status_code_default = status.HTTP_503_SERVICE_UNAVAILABLE
    message_default = "Embedding model failed to load."


# --- 500: 그 외 ---------------------------------------------------------------
class SimilaritySearchFailed(CodedHTTPException):
    code = "SIMILARITY_SEARCH_FAILED"
    status_code_default = status.HTTP_500_INTERNAL_SERVER_ERROR
    message_default = "Unexpected error during similarity search."


# --- 자체 생성 로고 벡터 저장소(관리자 전용) -----------------------------------
class GenerationVectorNotFound(CodedHTTPException):
    code = "GENERATION_VECTOR_NOT_FOUND"
    status_code_default = status.HTTP_404_NOT_FOUND
    message_default = "The requested generated logo vector was not found."


# --- 브랜드킷(F14) -------------------------------------------------------------
class BrandKitInvalidImage(CodedHTTPException):
    code = "BRANDKIT_INVALID_IMAGE"
    status_code_default = status.HTTP_400_BAD_REQUEST
    message_default = "logo_image_base64 could not be decoded as an image."


class BrandKitCompositionFailed(CodedHTTPException):
    code = "BRANDKIT_COMPOSITION_FAILED"
    status_code_default = status.HTTP_500_INTERNAL_SERVER_ERROR
    message_default = "Unexpected error while composing the brand kit image."


# --- 하위 호환 (기존 코드에서 참조) -------------------------------------------
class ModelInferenceException(CodedHTTPException):
    code = "MODEL_INFERENCE_FAILED"
    message_default = "Error during AI model inference."


class VectorSearchException(CodedHTTPException):
    code = "VECTOR_SEARCH_FAILED"
    message_default = "Error searching FAISS index."

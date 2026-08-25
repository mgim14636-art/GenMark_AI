from fastapi import APIRouter

from app.core.exceptions import GenerationVectorNotFound
from app.schemas.generation_vector import (
    CompareByIdRequest,
    CompareByIdResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.services.generation_vector_service import GenerationVectorService

router = APIRouter()


@router.post("/register", response_model=RegisterResponse)
def register(req: RegisterRequest):
    total = GenerationVectorService.register(req.image_url, req.id)
    return RegisterResponse(id=req.id, totalCount=total)


@router.post("/compare", response_model=CompareByIdResponse)
def compare(req: CompareByIdRequest):
    try:
        result = GenerationVectorService.compare_by_id(req.id, req.image_url, req.vector_image_url)
    except ValueError:
        raise GenerationVectorNotFound()
    return CompareByIdResponse(**result)

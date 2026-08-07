from fastapi import HTTPException, status

class ModelInferenceException(HTTPException):
    def __init__(self, detail: str = "Error during AI model inference"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)

class VectorSearchException(HTTPException):
    def __init__(self, detail: str = "Error searching FAISS index"):
        super().__init__(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)

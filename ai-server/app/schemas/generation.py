from pydantic import BaseModel, Field

class GenerationRequest(BaseModel):
    prompt: str = Field(..., example="Modern minimal geometric logo for tech startup")
    width: int = Field(512, example=512)
    height: int = Field(512, example=512)

class GenerationResponse(BaseModel):
    image_url: str
    status: str = "COMPLETED"
    prompt: str

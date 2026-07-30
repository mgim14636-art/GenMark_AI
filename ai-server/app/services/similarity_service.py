from typing import List, Dict, Any
from app.services.dino_service import DinoService
from app.services.faiss_service import FaissService

class SimilarityService:
    @staticmethod
    def process_similarity_search(image_url: str, top_k: int = 5) -> List[Dict[str, Any]]:
        vector = DinoService.extract_features(image_url)
        results = FaissService.search_similar(vector, top_k=top_k)
        return results

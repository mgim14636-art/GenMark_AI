import os
import faiss
import numpy as np
from app.core.config import settings
from app.core.logging import logger

class IndexManager:
    def __init__(self):
        self.dimension = 384
        self.index = None
        self._load_or_create_index()

    def _load_or_create_index(self):
        if os.path.exists(settings.faiss_index_path):
            try:
                self.index = faiss.read_index(settings.faiss_index_path)
                logger.info(f"Loaded existing FAISS index from {settings.faiss_index_path}")
            except Exception as e:
                logger.warning(f"Failed to read index: {e}, creating new index.")
                self.index = faiss.IndexFlatIP(self.dimension)
        else:
            logger.info("Creating new FAISS IndexFlatIP index")
            self.index = faiss.IndexFlatIP(self.dimension)

    def search(self, query_vector: np.ndarray, top_k: int = 5):
        if self.index is None or self.index.ntotal == 0:
            return [], []
        query_vector = np.ascontiguousarray(query_vector, dtype=np.float32)
        scores, indices = self.index.search(query_vector, top_k)
        return scores[0].tolist(), indices[0].tolist()

index_manager = IndexManager()

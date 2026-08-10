import os

import faiss
import numpy as np

from app.core.config import settings
from app.core.logging import logger


class IndexManager:
    def __init__(self):
        self.dimension = settings.embedding_dimension
        self.path = settings.embeddings_path
        self.index = None
        self.vectors = None
        self.load_error: str | None = None
        self._load_or_create_index()

    def _load_or_create_index(self):
        if not os.path.exists(self.path):
            self.load_error = f"embeddings not found: {self.path}"
            logger.warning("%s. Empty index created.", self.load_error)
            self.index = faiss.IndexFlatIP(self.dimension)
            self.vectors = np.zeros((0, self.dimension), dtype="float32")
            return

        vectors = np.load(self.path)
        if vectors.dtype != np.float32:
            logger.warning("embeddings dtype is %s, casting to float32", vectors.dtype)
            vectors = vectors.astype("float32")
        if vectors.ndim != 2 or vectors.shape[1] != self.dimension:
            self.load_error = (
                f"embeddings shape {vectors.shape} does not match (N, {self.dimension})"
            )
            logger.error(self.load_error)
            self.index = faiss.IndexFlatIP(self.dimension)
            self.vectors = np.zeros((0, self.dimension), dtype="float32")
            return

        self.vectors = np.ascontiguousarray(vectors, dtype="float32")
        self.index = faiss.IndexFlatIP(self.dimension)
        self.index.add(self.vectors)
        logger.info("FAISS index built: %s vectors from %s", self.index.ntotal, self.path)

    def search(self, query_vector: np.ndarray, top_k: int = 30):
        if self.index is None or self.index.ntotal == 0:
            return [], []
        q = np.ascontiguousarray(query_vector, dtype=np.float32)
        scores, indices = self.index.search(q, min(top_k, self.index.ntotal))
        return scores[0].tolist(), indices[0].tolist()

    def all_scores(self, query_vector: np.ndarray) -> np.ndarray:
        return self.vectors @ query_vector.astype("float32")


index_manager = IndexManager()
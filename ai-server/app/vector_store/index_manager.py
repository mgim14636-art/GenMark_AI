import os

import faiss
import numpy as np

from app.core.logging import logger

EMB_DIM = 768
EMB_PATH = os.path.join("data", "faiss", "embeddings.npy")


class IndexManager:
    def __init__(self):
        self.dimension = EMB_DIM
        self.index = None
        self.vectors = None
        self._load_or_create_index()

    def _load_or_create_index(self):
        if os.path.exists(EMB_PATH):
            self.vectors = np.load(EMB_PATH).astype("float32")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.index.add(self.vectors)
            logger.info(f"FAISS index built: {self.index.ntotal} vectors")
        else:
            logger.warning(f"{EMB_PATH} not found. Empty index created.")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.vectors = np.zeros((0, self.dimension), dtype="float32")

    def search(self, query_vector: np.ndarray, top_k: int = 30):
        if self.index is None or self.index.ntotal == 0:
            return [], []
        q = np.ascontiguousarray(query_vector, dtype=np.float32)
        scores, indices = self.index.search(q, min(top_k, self.index.ntotal))
        return scores[0].tolist(), indices[0].tolist()

    def all_scores(self, query_vector: np.ndarray) -> np.ndarray:
        return self.vectors @ query_vector.astype("float32")


index_manager = IndexManager()
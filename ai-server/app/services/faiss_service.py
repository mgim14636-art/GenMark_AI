from typing import Any, Dict, List

import numpy as np

from app.vector_store.index_manager import index_manager
from app.vector_store.metadata_store import metadata_store

DEDUP_THRESHOLD = 0.99


class FaissService:
    @staticmethod
    def search_similar(vector: List[float], top_k: int = 3, pool: int = 30) -> List[Dict[str, Any]]:
        q = np.array(vector, dtype=np.float32)

        all_scores = index_manager.all_scores(q)
        if all_scores.size == 0:
            return []
        mu, sd = float(all_scores.mean()), float(all_scores.std())
        if sd == 0:
            sd = 1e-6

        scores, indices = index_manager.search(q.reshape(1, -1), top_k=pool)

        results, kept = [], []
        for score, idx in zip(scores, indices):
            if idx == -1:
                continue
            vec = index_manager.vectors[idx]
            if any(float(vec @ index_manager.vectors[k]) > DEDUP_THRESHOLD for k in kept):
                continue
            kept.append(idx)
            results.append({
                "index": int(idx),
                "cos": float(score),
                "z": (float(score) - mu) / sd,
                "meta": metadata_store.get(idx),
            })
            if len(results) == top_k:
                break
        return results
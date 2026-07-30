import numpy as np
from typing import List, Dict, Any
from app.vector_store.index_manager import index_manager
from app.vector_store.metadata_store import metadata_store

class FaissService:
    @staticmethod
    def search_similar(vector: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        query_arr = np.array([vector], dtype=np.float32)
        scores, indices = index_manager.search(query_arr, top_k=top_k)

        results = []
        if not indices or indices == [-1]:
            # Mock return sample data if index is empty
            return [
                {"trademark_id": "TM-2026-001", "name": "Nexus Vector Logo", "similarity_score": 0.88},
                {"trademark_id": "TM-2026-002", "name": "Aether Brand Mark", "similarity_score": 0.74}
            ]

        for score, idx in zip(scores, indices):
            if idx == -1:
                continue
            meta = metadata_store.get(idx)
            results.append({
                "trademark_id": meta.get("trademark_id"),
                "name": meta.get("name"),
                "similarity_score": float(score)
            })

        return results

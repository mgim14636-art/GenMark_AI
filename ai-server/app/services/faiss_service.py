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

        # 자체 생성 로고(관리자가 수동 등록한 것)도 같은 풀에 넣어 함께 검색한다.
        # 지연 import — generation_vector_service가 similarity_service의 점수 함수를
        # 쓰고 similarity_service가 이 모듈을 쓰므로, 모듈 최상단에서 임포트하면
        # 순환 임포트가 된다.
        from app.services import generation_vector_service
        gen_vectors, gen_ids = generation_vector_service.load_all()

        candidates = [
            {"source": "KIPRIS", "vector": index_manager.vectors[idx], "cos": float(score),
             "meta": metadata_store.get(idx)}
            for score, idx in zip(scores, indices) if idx != -1
        ]
        candidates += [
            {"source": "GENERATED", "vector": gen_vectors[i], "cos": float(gen_vectors[i] @ q),
             "meta": {"candidate_public_id": gen_ids[i]}}
            for i in range(len(gen_ids))
        ]
        candidates.sort(key=lambda c: c["cos"], reverse=True)

        results, kept_vectors = [], []
        for candidate in candidates:
            vec = candidate["vector"]
            if any(float(vec @ kept) > DEDUP_THRESHOLD for kept in kept_vectors):
                continue
            kept_vectors.append(vec)
            results.append({
                "source": candidate["source"],
                "cos": candidate["cos"],
                "z": (candidate["cos"] - mu) / sd,
                "meta": candidate["meta"],
            })
            if len(results) == top_k:
                break
        return results

"""자체 생성 로고 벡터 저장소 (관리자 전용 "유사도 관리 및 테스트" 도구).

app/vector_store(KIPRIS 인덱스, 읽기전용, 서버 시작 시 한 번만 로드)와는 완전히
분리된 저장소다. 등록 상표가 아닌 자체 생성 로고를 KIPRIS 인덱스에 섞으면
"실제 등록 상표와 겹치는지" 검사의 의미가 흐려지므로 여기서 따로 관리한다.

KIPRIS와 같은 형식(embeddings.npy + ids.csv)을 쓰되, 이 파일들은 요청이 올
때마다 새로 벡터를 덧붙여 쓰는 쓰기 가능한 볼륨(generation-data)에 둔다.
같은 프로세스 안에서 동시에 여러 요청이 파일을 덮어써서 깨지는 일을 막기
위해 락을 하나 둔다(관리자 전용 저사양 트래픽이라 이 정도로 충분하다).
"""
import threading
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from app.core.config import settings
from app.services import note_service
from app.services.dino_service import DinoService
from app.services.similarity_service import DISCLAIMER, _risk_level, _to_score

_LOCK = threading.Lock()


def _load() -> tuple[np.ndarray, list[str]]:
    emb_path = Path(settings.generation_embeddings_path)
    ids_path = Path(settings.generation_ids_path)
    if not emb_path.exists() or not ids_path.exists():
        return np.zeros((0, settings.embedding_dimension), dtype=np.float32), []

    vectors = np.load(emb_path).astype(np.float32)
    ids = pd.read_csv(ids_path, dtype=str, encoding="utf-8-sig").iloc[:, 0].astype(str).tolist()
    return vectors, ids


def load_all() -> tuple[np.ndarray, list[str]]:
    """등록된 벡터 전체와 그 id 목록. 자동 유사도 검사(faiss_service)가 이 저장소도
    함께 검색할 때 쓴다. register()와 같은 락을 써서 쓰는 도중에 읽지 않게 한다."""
    with _LOCK:
        return _load()


def _save(vectors: np.ndarray, ids: list[str]) -> None:
    emb_path = Path(settings.generation_embeddings_path)
    ids_path = Path(settings.generation_ids_path)
    emb_path.parent.mkdir(parents=True, exist_ok=True)

    # 쓰다가 실패해도 기존 파일이 깨지지 않도록 임시 파일에 쓰고 원자적으로 교체한다.
    # np.save()는 파일명이 ".npy"로 안 끝나면 확장자를 자동으로 덧붙이므로(".tmp" ->
    # ".tmp.npy"), 그 동작을 피하려고 파일 객체를 직접 열어서 넘긴다.
    tmp_emb = emb_path.with_name(emb_path.name + ".tmp")
    with open(tmp_emb, "wb") as f:
        np.save(f, vectors)
    tmp_emb.replace(emb_path)

    tmp_ids = ids_path.with_name(ids_path.name + ".tmp")
    pd.DataFrame({"id": ids}).to_csv(tmp_ids, index=False)
    tmp_ids.replace(ids_path)


class GenerationVectorService:
    @staticmethod
    def register(image_src: str, item_id: str) -> int:
        """이미지를 벡터로 만들어 generation-data에 추가한다. 이미 있으면 그대로 둔다."""
        vector = np.asarray(DinoService.extract_features(image_src), dtype=np.float32)
        with _LOCK:
            vectors, ids = _load()
            if item_id in ids:
                return len(ids)
            vectors = np.vstack([vectors, vector[np.newaxis, :]])
            ids.append(item_id)
            _save(vectors, ids)
            return len(ids)

    @staticmethod
    def compare_by_id(item_id: str, image_src: str, vector_image_src: Optional[str] = None) -> dict:
        """저장된 벡터(item_id)와 새 이미지를 1:1로 비교한다. 기록하지 않는다.

        vector_image_src(등록된 벡터의 원본 이미지)가 함께 오면, 점수와는 별개로
        두 이미지가 왜 닮았는지 한 문장 설명(note)도 만든다. 점수 계산은 저장된
        벡터로만 하므로 note 생성이 실패해도 점수 결과는 그대로 나간다.
        """
        with _LOCK:
            vectors, ids = _load()
        if item_id not in ids:
            raise ValueError(f"등록되지 않은 id입니다: {item_id}")

        stored = vectors[ids.index(item_id)]
        comparison = np.asarray(DinoService.extract_features(image_src), dtype=np.float32)
        cosine = float(np.dot(stored, comparison))
        score = _to_score(cosine)

        note = None
        if vector_image_src:
            note = note_service.generate_pair_note(
                DinoService.to_bytes(vector_image_src), DinoService.to_bytes(image_src)
            )

        return {"similarity": score, "riskLevel": _risk_level(score), "disclaimer": DISCLAIMER, "note": note}

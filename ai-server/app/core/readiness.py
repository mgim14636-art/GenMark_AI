"""검색 준비 상태 검증 (백엔드 요구사항 §13, §14).

FastAPI 프로세스가 살아있다는 것과 "검색 가능하다"는 것은 다르다.
서버 시작 시 아래 8항목을 검사하고, 하나라도 실패하면 not_ready로 표시한다.

  1. 필수 파일 존재
  2. embeddings.npy dtype == float32
  3. 임베딩 차원 == 768
  4. NaN / Infinity 없음
  5. CSV 행 수 == ids 행 수 == 임베딩 행 수
  6. 각 image_path 파일 존재
  7. 출원번호 중복 없음
  8. 매니페스트의 모델·건수와 실제 값 일치

이미지 실존 검사(6)는 7천 건 stat 호출이라 시작 시간이 늘어난다.
STRICT_IMAGE_CHECK=false 로 두면 경고만 남기고 통과시킨다.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from app.core.config import settings
from app.core.logging import logger

APP_NO_COL = "출원번호"
IMAGE_COL = "이미지경로"

STRICT_IMAGE_CHECK = os.getenv("STRICT_IMAGE_CHECK", "true").lower() != "false"


@dataclass
class Readiness:
    ready: bool = False
    reason: str | None = None
    record_count: int = 0
    metadata_count: int = 0
    embedding_dimension: int = settings.embedding_dimension
    model_id: str = settings.model_id
    dataset_version: str | None = None
    warnings: list[str] = field(default_factory=list)

    def as_health_payload(self) -> dict:
        if self.ready:
            payload = {
                "status": "ready",
                "recordCount": self.record_count,
                "embeddingDimension": self.embedding_dimension,
                "metadataCount": self.metadata_count,
                "modelId": self.model_id,
            }
            if self.dataset_version:
                payload["datasetVersion"] = self.dataset_version
            if self.warnings:
                payload["warnings"] = self.warnings
            return payload
        return {"status": "not_ready", "reason": self.reason or "Unknown reason."}


def _load_manifest() -> dict | None:
    path = Path(settings.data_manifest_path)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("data_manifest.json parse failed: %s", e)
        return None


def evaluate() -> Readiness:
    """전체 검증을 수행하고 결과를 반환한다. 예외를 밖으로 던지지 않는다."""
    try:
        return _evaluate()
    except Exception as e:  # 검증 자체가 죽어서 서버가 못 뜨는 일은 막는다
        logger.exception("Readiness evaluation crashed")
        return Readiness(ready=False, reason=f"Readiness check failed: {e}")


def _evaluate() -> Readiness:
    # 순환 import 방지를 위해 지연 import
    from app.vector_store.index_manager import index_manager
    from app.vector_store.metadata_store import metadata_store

    r = Readiness()

    # (1) 필수 파일
    required = {
        "embeddings": settings.embeddings_path,
        "ids": settings.ids_path,
        "metadata": settings.trademark_metadata_path,
    }
    missing = [name for name, p in required.items() if not Path(p).exists()]
    if missing:
        r.reason = f"Required data files are missing: {', '.join(sorted(missing))}."
        return r

    vectors = index_manager.vectors
    if vectors is None or vectors.size == 0:
        r.reason = index_manager.load_error or "Embedding index is empty."
        return r

    # (2) dtype
    if vectors.dtype != np.float32:
        r.reason = f"Embedding dtype is {vectors.dtype}, expected float32."
        return r

    # (3) 차원
    if vectors.ndim != 2 or vectors.shape[1] != settings.embedding_dimension:
        r.reason = (
            f"Embedding shape {vectors.shape} does not match "
            f"(N, {settings.embedding_dimension})."
        )
        return r

    # (4) NaN / Inf
    if not np.isfinite(vectors).all():
        r.reason = "Embeddings contain NaN or Infinity."
        return r

    # (5) 건수 일치
    emb_n = int(vectors.shape[0])
    meta_n = len(metadata_store)
    ids = _read_ids(settings.ids_path)
    ids_n = len(ids)
    if not (emb_n == meta_n == ids_n):
        r.reason = (
            "Embedding and metadata counts do not match "
            f"(embeddings={emb_n}, metadata={meta_n}, ids={ids_n})."
        )
        return r

    # 순서 정합성: ids.csv N번째 == trademarks.csv N번째
    meta_ids = metadata_store.column(APP_NO_COL)
    if meta_ids and ids and meta_ids != ids:
        first = next(
            (i for i, (a, b) in enumerate(zip(meta_ids, ids)) if a != b), None
        )
        r.reason = f"ids.csv and trademarks.csv order diverge at row {first}."
        return r

    # (7) 출원번호 중복
    if meta_ids and len(set(meta_ids)) != len(meta_ids):
        dup = len(meta_ids) - len(set(meta_ids))
        r.reason = f"trademarks.csv contains {dup} duplicated application numbers."
        return r

    # (6) 이미지 실존
    missing_images = _count_missing_images(metadata_store)
    if missing_images:
        msg = f"{missing_images} image files referenced by trademarks.csv are missing."
        if STRICT_IMAGE_CHECK:
            r.reason = msg
            return r
        logger.warning(msg)
        r.warnings.append(msg)

    # (8) 매니페스트 대조
    manifest = _load_manifest()
    if manifest:
        r.dataset_version = manifest.get("datasetVersion")
        if manifest.get("recordCount") not in (None, emb_n):
            r.reason = (
                f"Manifest recordCount {manifest.get('recordCount')} "
                f"does not match actual {emb_n}."
            )
            return r
        if manifest.get("modelId") not in (None, settings.model_id):
            r.reason = (
                f"Manifest modelId {manifest.get('modelId')} "
                f"does not match configured {settings.model_id}."
            )
            return r
        if manifest.get("embeddingDimension") not in (
            None,
            settings.embedding_dimension,
        ):
            r.reason = "Manifest embeddingDimension does not match configuration."
            return r
    else:
        r.warnings.append("data_manifest.json is missing; version check skipped.")

    r.ready = True
    r.record_count = emb_n
    r.metadata_count = meta_n
    return r


def _read_ids(path: str) -> list[str]:
    import pandas as pd

    df = pd.read_csv(path, dtype=str, encoding="utf-8-sig")
    if df.empty:
        return []
    return df.iloc[:, 0].astype(str).str.strip().tolist()


def _count_missing_images(store) -> int:
    root = Path(settings.trademark_data_root)
    paths = store.column(IMAGE_COL)
    return sum(1 for p in paths if p and not (root / p).exists())


# 시작 시 1회 평가하고 결과를 캐시한다.
_state: Readiness | None = None


def get_state(refresh: bool = False) -> Readiness:
    global _state
    if _state is None or refresh:
        _state = evaluate()
        if _state.ready:
            logger.info(
                "Similarity search READY: %s records, model=%s",
                _state.record_count,
                _state.model_id,
            )
        else:
            logger.error("Similarity search NOT READY: %s", _state.reason)
    return _state

from typing import Any, Dict

import pandas as pd

from app.core.exceptions import SimilarityDataNotReady
from app.core.logging import logger
from app.services.dino_service import DinoService
from app.services.faiss_service import FaissService

# 실제 등록 상표 간 1위 z 분포에 앵커링 (200건 샘플, 중앙값 2.72 / 상위5% 4.91)
# 이미 공존 등록된 상표 쌍의 유사 수준을 정상 범위로 보고,
# 중앙값 → 30점(SAFE 경계), 상위 5% → 60점(CAUTION 경계)으로 선형 매핑
Z_SLOPE = 13.7
Z_INTERCEPT = -7.3

DISCLAIMER = (
    "본 분석은 로고 이미지의 시각적 유사성을 보여주는 참고 자료이며, "
    "상표 등록 가능 여부나 법적 침해 여부를 판단하지 않습니다."
)


def _name(meta: dict) -> str:
    for col in ("상표한글명", "상표영문명"):
        v = meta.get(col)
        if v and pd.notna(v) and str(v).strip():
            return str(v).strip()
    return f"상표 {str(meta.get('출원번호', ''))[-6:]}"


def _category(meta: dict) -> str:
    """백엔드 계약: 빈 문자열 금지. '03류 · 도형복합' 형태."""
    cls = str(meta.get("류", "") or "").split("|")[0].strip()
    kind = str(meta.get("상표구분코드명", "") or "").strip()
    parts = []
    if cls:
        parts.append(f"{cls}류")
    if kind:
        parts.append(kind)
    return " · ".join(parts) if parts else "분류 미상"


def _to_score(z: float) -> int:
    """z → 0~100 정수.

    truncation 대신 반올림을 쓴다. int()로 잘라내면 앵커가 어긋나
    중앙값(z=2.72)이 29점이 되어 SAFE/MODERATE 경계 설계가 깨진다.
    NaN은 0으로, ±Inf는 clamp로 흡수한다.
    """
    v = z * Z_SLOPE + Z_INTERCEPT
    if v != v:  # NaN
        return 0
    return int(round(min(100.0, max(0.0, v))))


def _risk_level(score: int) -> str:
    if score < 30:
        return "SAFE"
    if score < 60:
        return "MODERATE"
    return "CAUTION"


class SimilarityService:
    @staticmethod
    def process_similarity_search(image_src: str, top_k: int = 3) -> Dict[str, Any]:
        vector = DinoService.extract_features(image_src)
        raw = FaissService.search_similar(vector, top_k=top_k)

        if not raw:
            raise SimilarityDataNotReady()

        rows = []
        for r in raw:
            meta = r["meta"]
            app_no = str(meta.get("출원번호", "") or "").strip()
            image_path = str(meta.get("이미지경로", "") or "").strip().replace("\\", "/")
            if not app_no or not image_path:
                # 메타데이터가 깨진 행은 계약(빈 문자열 금지)을 만족할 수 없으므로 제외
                logger.warning("Skipping match with incomplete metadata: index=%s", r.get("index"))
                continue
            rows.append({
                "applicationNumber": app_no,
                "name": _name(meta),
                "category": _category(meta),
                "similarity": _to_score(r["z"]),
                "imagePath": image_path,
            })

        if not rows:
            raise SimilarityDataNotReady("Matched trademark metadata is incomplete.")

        # 계약: similarity 내림차순 정렬 + rank 1부터 순차 증가
        rows.sort(key=lambda m: m["similarity"], reverse=True)
        matches = [{"rank": i, **m} for i, m in enumerate(rows, 1)]

        max_sim = matches[0]["similarity"]
        return {
            "maxSimilarity": max_sim,
            "riskLevel": _risk_level(max_sim),
            "matches": matches,
            "disclaimer": DISCLAIMER,
        }
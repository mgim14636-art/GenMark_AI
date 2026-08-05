from typing import Any, Dict

import pandas as pd

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
    cls = str(meta.get("류", "")).split("|")[0]
    label = "화장품" if cls == "03" else f"{cls}류"
    return f"{label} · {meta.get('상표구분코드명', '')}"


def _to_score(z: float) -> int:
    return int(min(100, max(0, z * Z_SLOPE + Z_INTERCEPT)))


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

        matches = []
        for i, r in enumerate(raw, 1):
            meta = r["meta"]
            matches.append({
                "rank": i,
                "applicationNumber": meta.get("출원번호", ""),
                "name": _name(meta),
                "category": _category(meta),
                "similarity": _to_score(r["z"]),
                "imagePath": meta.get("이미지경로", ""),
            })

        max_sim = matches[0]["similarity"] if matches else 0
        return {
            "maxSimilarity": max_sim,
            "riskLevel": _risk_level(max_sim),
            "matches": matches,
            "disclaimer": DISCLAIMER,
        }
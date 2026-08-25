from typing import Any, Dict

import pandas as pd

from app.core.exceptions import SimilarityDataNotReady
from app.core.logging import logger
from app.services.dino_service import DinoService
from app.services.faiss_service import FaissService
from app.services import note_service

# 점수는 원시 코사인 유사도를 구간별 선형으로 매핑한다.
#
# 이전에는 z 점수(쿼리별 평균·표준편차로 정규화)를 썼으나 실측에서 폐기했다.
# z는 쿼리마다 기준이 달라져 쿼리 간 비교가 불가능하다. 실제로 DB 상표를 그대로
# 넣었을 때(코사인 1.0) z가 3.49인 반면, 무관한 생성 로고가 4.14로 더 높게 나오는
# 역전이 확인됐다. 코사인은 [-1, 1]로 이미 정규화돼 있어 그런 문제가 없다.
#
# 앵커 (scripts/calibrate_score.py 실측, 2026-08-10):
#   0.80 = 생성 로고 top-1 코사인 p95   → 30점 (SAFE 상한)
#   0.89 = 등록 상표 간 최근접 중앙값    → 60점 (CAUTION 진입)
#          이미 공존 등록된 상표 쌍의 유사 수준이므로 여기서부터 경고한다
#   1.00 = 사실상 동일                  → 100점
#   0.42 = 코퍼스 쌍별 코사인 평균(0.488) 아래. 이 밑은 "무작위 상표 쌍 수준"이라
#          유사성 신호가 없다고 본다. 평균에 딱 붙이면 저점 구간이 전부 0점으로
#          뭉개져 결과 화면이 고장 난 것처럼 보이므로 조금 낮춰 눈금을 남긴다.
COS_ANCHORS = ((0.42, 0.0), (0.80, 30.0), (0.89, 60.0), (1.00, 100.0))

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


def _to_score(cos: float) -> int:
    """코사인 유사도 → 0~100 정수.

    COS_ANCHORS 사이를 구간별 선형 보간한다. 단일 직선으로는
    "무관한 로고는 낮게, 공존 등록 수준은 경고로" 두 조건을 동시에 만족시킬 수 없다.
    NaN은 0으로, 범위 밖은 clamp로 흡수한다.
    """
    if cos != cos:  # NaN
        return 0
    lo_c, lo_s = COS_ANCHORS[0]
    if cos <= lo_c:
        return int(lo_s)
    for (c0, s0), (c1, s1) in zip(COS_ANCHORS, COS_ANCHORS[1:]):
        if cos <= c1:
            ratio = (cos - c0) / (c1 - c0)
            return int(round(min(100.0, max(0.0, s0 + ratio * (s1 - s0)))))
    return 100


def _risk_level(score: int) -> str:
    if score < 30:
        return "SAFE"
    if score < 60:
        return "MODERATE"
    return "CAUTION"


class SimilarityService:
    @staticmethod
    def process_similarity_search(
        image_src: str, top_k: int = 3, with_notes: bool = True
    ) -> Dict[str, Any]:
        vector = DinoService.extract_features(image_src)
        raw = FaissService.search_similar(vector, top_k=top_k)

        if not raw:
            raise SimilarityDataNotReady()

        rows = []
        for r in raw:
            meta = r["meta"]
            source = r.get("source", "KIPRIS")
            if source == "GENERATED":
                # 관리자가 수동 등록해둔 자체 생성 로고. KIPRIS처럼 상표명·류·이미지
                # 파일이 없으므로, 백엔드가 candidatePublicId로 자기 DB를 다시 조회해
                # name·category·이미지를 채운다 — 여기선 조회 키만 정확히 넘긴다.
                candidate_id = str(meta.get("candidate_public_id", "") or "").strip()
                if not candidate_id:
                    logger.warning("Skipping generated match with missing candidate id")
                    continue
                rows.append({
                    "applicationNumber": candidate_id,
                    "name": "자체 생성 로고",
                    "category": "자체 생성 로고",
                    "similarity": _to_score(r["cos"]),
                    "imagePath": candidate_id,
                    "source": "GENERATED",
                })
                continue

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
                "similarity": _to_score(r["cos"]),
                "imagePath": image_path,
                "source": "KIPRIS",
            })

        if not rows:
            raise SimilarityDataNotReady("Matched trademark metadata is incomplete.")

        # 계약: similarity 내림차순 정렬 + rank 1부터 순차 증가
        rows.sort(key=lambda m: m["similarity"], reverse=True)
        matches = [{"rank": i, **m} for i, m in enumerate(rows, 1)]

        # 설명 생성은 정렬이 끝난 뒤에 한다. 순서가 바뀌면 설명이 엉뚱한 상표에 붙는다.
        # KIPRIS 매치만 대상으로 한다 — generate_notes()는 이미지경로를 trademark_data_root
        # 기준 상대경로로 읽는데, 자체 생성 로고는 그런 파일이 없어서 하나라도 섞이면
        # 배치 전체가 note 없이 반환된다(note_service.generate_notes 참고).
        kipris_positions = [i for i, m in enumerate(matches) if m["source"] == "KIPRIS"]
        if with_notes and kipris_positions and note_service.is_enabled():
            try:
                notes = note_service.generate_notes(
                    DinoService.to_bytes(image_src),
                    [matches[i]["imagePath"] for i in kipris_positions],
                )
                for pos, note in zip(kipris_positions, notes):
                    if note:
                        matches[pos]["note"] = note
            except Exception as e:
                # note는 부가 정보다. 어떤 실패도 점수 결과를 막아서는 안 된다.
                logger.warning("Note attach skipped: %s", type(e).__name__)

        max_sim = matches[0]["similarity"]
        return {
            "maxSimilarity": max_sim,
            "riskLevel": _risk_level(max_sim),
            "matches": matches,
            "disclaimer": DISCLAIMER,
        }
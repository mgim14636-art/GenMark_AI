"""top_left, skincare_set 목업을 PIL 원근 합성용 브랜드킷 템플릿으로 정의한다.

product_mockup_ai_service.py(AI 이미지 편집)는 장면 전체를 다시 그리므로 목업 사진의
디테일과 로고 글자가 매번 조금씩 달라질 위험이 있어, 이 파일은 AI 호출 없이 PIL로
로고 이미지를 그대로 라벨 영역에 원근 변형해 끼워 넣는 경로를 제공한다.
product_mockup.py/brand_kit.py의 기존 함수(compose_brand_kit)를 그대로 재사용하므로
목업 사진 자체는 로고가 들어간 영역 외에는 원본과 픽셀 단위로 동일하다.

skincare_set(set-skin-care-package-design-resource.png, 4672x7000 고해상도)은
2026-08-22 grid overlay로 실측. jar는 통이 작아 텍스트 없이 로고만 크게(2026-08-22
2차, 확대+하향 조정) 넣고, toner_bottle/white_bottle은 로고+브랜드명+제품종류+용량
3줄 텍스트를 넣는다(별도 텍스트 렌더링 단계에서 처리, 이 파일은 좌표만 정의).
"""
import os

from app.services.brand_kit import BrandKitTemplate
from app.services.product_mockup import LabelRegion

_ASSET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")


def _rect(left: int, top: int, right: int, bottom: int) -> LabelRegion:
    return LabelRegion(
        top_left=(left, top), top_right=(right, top),
        bottom_right=(right, bottom), bottom_left=(left, bottom),
    )


COSMETIC_MOCKUP_TEMPLATES = {
    "top_left": BrandKitTemplate(
        name="top_left",
        image_path=os.path.join(_ASSET_DIR, "top_left.png"),
        regions=[
            ("spray_bottle", _rect(322, 180, 410, 240)),
            ("dropper_bottle", _rect(400, 215, 468, 270)),
            ("jar", _rect(238, 268, 308, 298)),
        ],
        padding_ratio=0.14,
    ),
    "skincare_set": BrandKitTemplate(
        name="skincare_set",
        image_path=os.path.join(_ASSET_DIR, "set-skin-care-package-design-resource.png"),
        regions=[
            # [2026-08-24] toner_bottle/white_bottle 폭을 넓혔다 — padding_ratio를
            # 아무리 줄여도 로고가 라벨 영역 "폭"에 막혀 더 안 커졌다(실측 확인:
            # 병 실제 유리/플라스틱 폭은 훨씬 넓은데 라벨 영역만 좁게 잡혀 있었음).
            ("toner_bottle", _rect(2280, 3754, 2680, 4300)),
            ("white_bottle", _rect(3230, 4012, 3820, 4550)),
            # jar: 통이 작아 로고만 크게 + 아래쪽으로(2026-08-22 확대/하향 조정).
            # [2026-08-24] 폭(600)보다 높이(240)가 더 좁아서 정사각형에 가까운
            # 로고가 높이에 막혀 있었다 — 위쪽(뚜껑 나사산 끝나는 지점 바로 아래)
            # 으로 넓혀 높이를 410으로 키웠다.
            # [2026-08-24 2차] _fit_cover가 하단 기준 크롭으로 바뀌면서 화면 아래쪽은
            # 더 이상 잘리지 않으므로, 자 몸통 기준 여유 안에서 100px 더 아래로 내렸다
            # (자 받침 시작점 y≈6020보다 위, 60px 여유).
            ("jar", _rect(1100, 5550, 1780, 5960)),
        ],
        # [2026-08-24] 0.14 -> 0.05 -> 0.02: 로고를 계속 더 크게 해달라는 요청.
        # 값이 작을수록 라벨 영역 안에서 로고가 차지하는 비율이 커진다(padding_ratio는
        # "깎아내는 여백" 비율). 0에 가까울수록 라벨 영역 경계에 거의 닿을 때까지 커진다.
        padding_ratio=0.02,
    ),
}
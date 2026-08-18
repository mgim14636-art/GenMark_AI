"""민트톤 화장품 선물세트 사진(드롭퍼 병+자+작은 병)을 3구역 브랜드킷 템플릿으로
정의한다. 자 2개 중 하나는 다른 하나에 절반 이상 가려져 있어 라벨 대상에서 뺐다."""

import os

from app.services.product_mockup import LabelRegion
from app.services.brand_kit import BrandKitTemplate

_ASSET_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
_PHOTO_PATH = os.path.join(_ASSET_DIR, "cosmetic_gift_set.png")

COSMETIC_GIFT_SET_TEMPLATE = BrandKitTemplate(
    name="cosmetic_gift_set",
    image_path=_PHOTO_PATH,
    # 세 용기 모두 사진 속에서 수직이 아니라 비스듬히 기울어져 놓여있어서,
    # 라벨 영역도 축에 맞춰 회전된 사각형(quad)으로 잡아야 병에 "인쇄된" 느낌이 난다.
    regions=[
        ("dropper_bottle", LabelRegion(
            top_left=(153, 464), top_right=(224, 501),
            bottom_right=(182, 581), bottom_left=(111, 544),
        )),
        ("jar_front", LabelRegion(
            top_left=(225, 553), top_right=(331, 582),
            bottom_right=(315, 644), bottom_left=(209, 615),
        )),
        ("bottle", LabelRegion(
            top_left=(388, 602), top_right=(443, 644),
            bottom_right=(383, 723), bottom_left=(327, 681),
        )),
    ],
    padding_ratio=0.24,
)

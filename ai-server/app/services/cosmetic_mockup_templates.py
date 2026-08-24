"""top_left/top_right/bottom_left 목업 3장을 PIL 원근 합성용 브랜드킷 템플릿으로 정의한다.

product_mockup_ai_service.py(AI 이미지 편집)는 장면 전체를 다시 그리므로 목업 사진의
디테일(액자 그림, 나무 결, 병 반사 등)이 매번 조금씩 달라지고, 조합 로고(심볼+워드마크)의
글자가 편집 과정에서 흐트러질 위험이 있다. 사용자가 "목업 파일이 절대 깨지면 안 된다,
로고만 정확히 인쇄돼야 한다"고 명시적으로 요청해서, 이 파일은 그 반대 극단 — AI 호출
없이 PIL로 로고 이미지를 그대로(글자 포함) 라벨 영역에 원근 변형해 끼워 넣는 경로를
제공한다. product_mockup.py/brand_kit.py의 기존 함수(compose_brand_kit)를 그대로
재사용하므로 목업 사진 자체는 로고가 들어간 영역 외에는 원본과 픽셀 단위로 동일하다.

라벨 영역 좌표는 격자 오버레이로 실측(2026-08-20/21)한 값이다 — 세 병 모두 사진마다
거의 정면으로 놓여 있어 사각형(축에 맞춘 4점)으로도 자연스럽다.
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


#
# [실측 — 2026-08-21, 1차] _restore_original_text에서 쓰던 "기존 인쇄 문구" 박스를
# 그대로 라벨 영역으로 재사용했더니 로고가 작고 어중간한 위치에 찍혔다. 그래서
# 문구 위쪽 여백으로 옮겼는데, 그 좌표는 병 몸통이 아니라 실제로는 펌프/드로퍼
# 캡·자 입구 테두리 위에 걸쳐 있었다(세로 스트립을 직접 잘라 육안 확인, 2026-08-21
# 2차) — 로고가 유리가 아닌 금속 펌프·플라스틱 캡 위에 그려지면서 병 정면 밖으로
# "튀어나온" 것처럼 보였다.
#
# [2026-08-22] 위 실측치와 별개로, 사용자가 mockup_compositor.py로 눈대중 보정하며
# label_zones.json에 좌표를 직접 캘리브레이션했다. create_brand_kit()은 그 JSON을
# 전혀 읽지 않고 이 파일의 좌표만 썼기 때문에, label_zones.json을 아무리 고쳐도
# 실제 생성 결과에는 반영되지 않는 불일치가 있었다(사용자 실측 확인 — "결과 이미지가
# 좌표대로 안 나와"). 아래 좌표는 label_zones.json의 quad 값을 그대로 옮긴 것이다 —
# 이제 이 파일이 두 좌표 체계의 유일한 정본이다. label_zones.json/mockup_compositor.py를
# 지워도 이 파일엔 영향 없다.
#
# [한계] label_zones.json은 zone(부위)별로 shading_strength·max_width_ratio를 따로
# 갖지만, BrandKitTemplate.padding_ratio는 템플릿 하나에 값 하나뿐이다(product_mockup.py/
# brand_kit.py를 안 건드리기로 한 제약 때문에 부위별 padding은 지원 안 함). 세 부위 중
# 둘은 max_width_ratio 0.95(여백 거의 없음), 자만 0.8~0.95로 조금 다른데, 아래
# padding_ratio=0.05는 "여백 거의 없음" 쪽에 맞춘 값이라 자는 label_zones.json 결과보다
# 살짝 크게 나올 수 있다.
COSMETIC_MOCKUP_TEMPLATES = {
    "top_left": BrandKitTemplate(
        name="top_left",
        image_path=os.path.join(_ASSET_DIR, "top_left.png"),
        regions=[
            ("spray_bottle", _rect(337, 171, 403, 219)),
            ("jar", _rect(247, 277, 299, 298)),
            ("dropper_bottle", _rect(422, 225, 458, 252)),
        ],
        padding_ratio=0.05,
    ),
    "top_right": BrandKitTemplate(
        name="top_right",
        image_path=os.path.join(_ASSET_DIR, "top_right.png"),
        regions=[
            ("spray_bottle", _rect(330, 229, 406, 258)),
            ("jar", _rect(253, 293, 299, 302)),
            ("dropper_bottle", _rect(419, 245, 468, 266)),
        ],
        padding_ratio=0.05,
    ),
    "bottom_left": BrandKitTemplate(
        name="bottom_left",
        image_path=os.path.join(_ASSET_DIR, "bottom_left.png"),
        regions=[
            ("spray_bottle", _rect(342, 232, 416, 263)),
            ("jar", _rect(258, 296, 304, 308)),
            ("dropper_bottle", _rect(450, 253, 510, 277)),
        ],
        padding_ratio=0.05,
    ),
}

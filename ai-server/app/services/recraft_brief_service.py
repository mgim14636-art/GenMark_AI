"""BriefRequest(백엔드가 보낸 설문)를 받아 프롬프트를 만들고, generate_image=True면
Recraft로 실제 이미지까지 생성하는 서비스.
"""
import base64
import random
from io import BytesIO

from PIL import Image

from app.services.recraft_brief_builder import build_recraft_brief
from app.services.logo_gen_service import _call_image_api


def _image_to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class RecraftBriefService:
    @staticmethod
    def generate(req) -> dict:
        """BriefResponse에 그대로 매핑 가능한 dict."""
        survey = req.model_dump(exclude={"generate_image"})
        prompt = build_recraft_brief(survey)
        result = {"prompt": prompt, "image_base64": None}
        if req.generate_image:
            seed = random.randint(0, 2_147_483_647)
            image, _svg = _call_image_api(prompt, seed=seed)
            result["image_base64"] = _image_to_base64(image)
        return result

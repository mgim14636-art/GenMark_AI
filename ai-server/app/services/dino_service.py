import base64
import binascii
import io
import os
from typing import List, Union

import numpy as np
import torch
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.exceptions import InvalidBase64, ModelNotReady, UnsupportedImage
from app.core.logging import logger
from app.models.dino_model import dino_loader

# 임베딩 품질을 담보할 수 없는 초소형 이미지는 거부한다.
MIN_SIDE = 8


class DinoService:
    @staticmethod
    def _decode(src: Union[str, bytes]) -> bytes:
        """Base64 문자열(또는 배치용 파일 경로)을 원본 바이트로 변환한다.

        길이로 Base64/경로를 구분하면 작은 PNG가 경로로 오인된다.
        계약상 입력은 항상 Base64이므로, 경로는 실제로 존재할 때만 인정한다.
        """
        if isinstance(src, bytes):
            return src

        s = src.strip()
        # data URI 접두사가 붙어도 받아준다. (계약상 백엔드는 순수 Base64 전송)
        if s.startswith("data:") and "," in s[:64]:
            s = s.split(",", 1)[1]

        # 배치·테스트에서 로컬 경로를 넘기는 경우
        if len(s) < 4096:
            try:
                if os.path.exists(s):
                    with open(s, "rb") as f:
                        return f.read()
            except (OSError, ValueError):
                pass

        try:
            # 개행·공백이 섞여 와도 허용
            return base64.b64decode("".join(s.split()), validate=True)
        except (binascii.Error, ValueError) as e:
            # 원문은 로그에 남기지 않는다.
            logger.warning("Base64 decode failed: %s", type(e).__name__)
            raise InvalidBase64()

    @staticmethod
    def _to_image(src: Union[str, bytes]) -> Image.Image:
        data = DinoService._decode(src)
        try:
            img = Image.open(io.BytesIO(data))
            img.load()
        except (UnidentifiedImageError, OSError, ValueError) as e:
            logger.warning("Image open failed: %s", type(e).__name__)
            raise UnsupportedImage()

        if min(img.size) < MIN_SIDE:
            raise UnsupportedImage(
                f"Image is too small: {img.size}. Minimum side is {MIN_SIDE}px."
            )

        img = ImageOps.exif_transpose(img)  # EXIF 회전 반영

        # 투명 배경은 흰색으로 합성 — KIPRIS 상표 이미지가 모두 흰 배경이므로
        # 조건을 맞추지 않으면 투명 영역이 검은색으로 변환되어 임베딩이 어긋난다
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(bg, img)

        return img.convert("RGB")

    @staticmethod
    def extract_features(image_src: Union[str, bytes]) -> List[float]:
        # 입력 검증을 먼저 한다. 모델을 먼저 로드하면 잘못된 Base64가
        # 400이 아니라 503(모델 미준비)으로 잘못 분류된다.
        image = DinoService._to_image(image_src)

        try:
            processor, model = dino_loader.load_model()
        except Exception as e:
            logger.error("DINOv2 load failed: %s: %s", type(e).__name__, e)
            raise ModelNotReady()

        with torch.no_grad():
            outputs = model(**processor(images=image, return_tensors="pt"))

        vec = outputs.last_hidden_state[:, 0, :].numpy()[0].astype(np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        logger.info(f"Feature extracted: dim={vec.shape[0]}")
        return vec.tolist()
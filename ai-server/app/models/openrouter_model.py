import os

from dotenv import load_dotenv

from app.core.logging import logger

load_dotenv()


class OpenRouterKeyLoader:
    """로고 생성은 로컬 파이프라인이 아니라 OpenRouter 원격 API 호출이다
    (app/services/logo_gen_service.py 참고) — 실제로 로드할 모델이 없다. 그래도
    ModelManager.preload_all_models()가 기대하는 load_model() 인터페이스는
    맞춰줘야 하므로, 여기서는 OPENROUTER_API_KEY가 설정돼 있는지만 앱 기동 시점에
    확인해 키 누락을 요청이 실패하기 전에 로그로 미리 알 수 있게 한다.
    """

    def __init__(self):
        self.model = None
        logger.info("Initializing OpenRouter key check...")

    def load_model(self):
        if self.model is None:
            if not os.environ.get("OPENROUTER_API_KEY"):
                raise RuntimeError("OPENROUTER_API_KEY가 설정되지 않았습니다.")
            logger.info("OPENROUTER_API_KEY 확인됨 (로고 생성은 원격 API 호출이라 로컬 로딩 없음).")
            self.model = "OPENROUTER_API_KEY_OK"
        return self.model


openrouter_loader = OpenRouterKeyLoader()

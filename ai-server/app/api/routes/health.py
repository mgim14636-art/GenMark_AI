from fastapi import APIRouter, Response, status

from app.core.config import settings
from app.core.readiness import get_state

router = APIRouter()


@router.get("/health")
def health_check(response: Response):
    """실제 검색 준비 상태를 반환한다.

    프로세스가 떠 있다는 이유만으로 ok를 반환하지 않는다.
    데이터 미설치·건수 불일치 시 503.
    """
    state = get_state()
    payload = state.as_health_payload()
    payload["service"] = settings.app_name
    if not state.ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return payload

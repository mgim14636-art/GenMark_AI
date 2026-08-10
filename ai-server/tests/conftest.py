"""테스트 부트스트랩.

계약 테스트(test_similarity.py)는 DINOv2 추론을 스텁으로 대체하므로 torch가 필요 없다.
그러나 app.services.dino_service가 모듈 로드 시점에 torch를 import 하기 때문에,
torch/transformers가 설치되지 않은 환경(가벼운 CI 등)에서는 최소 스텁을 넣어준다.

torch가 실제로 설치돼 있으면 스텁은 적용되지 않고 진짜 모듈을 쓴다.
실제 모델·데이터로 도는 검증은 통합 테스트에서 수행한다.
"""
import importlib.util
import sys
import types
from pathlib import Path

# ai-server 루트를 import 경로에 추가 (pytest를 어디서 실행하든 app 패키지를 찾도록)
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _missing(name: str) -> bool:
    return importlib.util.find_spec(name) is None


if _missing("torch"):
    torch = types.ModuleType("torch")

    class _NoGrad:
        def __enter__(self):
            return None

        def __exit__(self, *exc):
            return False

    torch.no_grad = lambda: _NoGrad()
    torch.cuda = types.SimpleNamespace(is_available=lambda: False)
    sys.modules["torch"] = torch

if _missing("transformers"):
    transformers = types.ModuleType("transformers")
    # 실제 모델이 필요한 테스트는 이 플래그를 보고 skip 한다.
    transformers.IS_STUB = True

    class _Unavailable:
        @classmethod
        def from_pretrained(cls, *a, **k):
            raise RuntimeError("transformers is not installed in this environment")

    transformers.AutoImageProcessor = _Unavailable
    transformers.AutoModel = _Unavailable
    transformers.AutoTokenizer = _Unavailable
    sys.modules["transformers"] = transformers

if _missing("faiss"):
    faiss = types.ModuleType("faiss")

    class _IndexFlatIP:
        def __init__(self, dim):
            self.d = dim
            self.ntotal = 0

        def add(self, vectors):
            self.ntotal += len(vectors)

        def search(self, q, k):
            import numpy as np

            return np.zeros((1, k), dtype="float32"), np.full((1, k), -1, dtype="int64")

    faiss.IndexFlatIP = _IndexFlatIP
    sys.modules["faiss"] = faiss

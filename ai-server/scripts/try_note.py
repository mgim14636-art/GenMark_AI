"""유사 근거 설명(note) 생성만 따로 진단한다.

유사도 전체를 돌리면 로그가 섞여서 note가 왜 안 나오는지 알기 어렵다.
설정 -> 이미지 준비 -> API 호출 -> 파싱 -> 필터를 단계별로 찍는다.

    cd ai-server
    python scripts/try_note.py
    python scripts/try_note.py --model google/gemma-4-26b-a4b-it:free
    python scripts/try_note.py --raw       # 모델 원문 응답까지 출력
"""
import os

os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main(argv) -> int:
    show_raw = "--raw" in argv
    if "--model" in argv:
        os.environ["NOTE_MODEL"] = argv[argv.index("--model") + 1]
    if "--provider" in argv:
        os.environ["NOTE_PROVIDER"] = argv[argv.index("--provider") + 1]

    from app.core.config import settings
    from app.services import note_service as ns

    print("=" * 66)
    print("1) 설정")
    provider = ns._provider()
    key = ns._api_key()
    print(f"   NOTE_PROVIDER : {os.environ.get('NOTE_PROVIDER') or '(미설정 → 자동)'}")
    print(f"   실제 사용     : {provider}")
    print(f"   모델          : {ns._model()}")
    print(f"   키            : {'있음 (' + key[:8] + '...)' if key else '❌ 없음'}")
    print(f"   타임아웃      : {ns._timeout()}초")
    print(f"   is_enabled()  : {ns.is_enabled()}")
    if not ns.is_enabled():
        need = "OPENROUTER_API_KEY" if provider == "openrouter" else "GEMINI_API_KEY"
        print(f"\n   → .env에 {need}가 없습니다. note는 항상 생략됩니다.")
        return 1

    # 쿨다운이 걸려 있으면 조용히 건너뛰므로 풀어준다
    ns._quota_blocked_until = 0.0

    print("\n2) 이미지 준비")
    root = Path(settings.trademark_data_root)
    if not root.exists():
        print(f"   ❌ 상표 이미지 경로가 없습니다: {root}")
        return 1

    import csv
    meta = Path(settings.trademark_metadata_path)
    rels = []
    with open(meta, encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f)):
            if i >= 2:
                break
            rels.append(row["이미지경로"])
    if len(rels) < 2:
        print("   ❌ 상표 메타데이터에서 이미지를 찾지 못했습니다")
        return 1

    # 쿼리는 상표 하나를 그대로 쓴다. 생성 로고가 없어도 진단이 되도록.
    query_path = root / rels[0]
    query_bytes = query_path.read_bytes()
    targets = rels[:2]
    print(f"   쿼리     : {rels[0]}")
    for r in targets:
        print(f"   검출 상표 : {r}")

    print("\n3) API 호출")
    if show_raw and provider == "openrouter":
        images = [ns._encode(query_bytes)] + [ns._encode(root / r) for r in targets]
        text = ns._call_openrouter(images)
        print("   ── 모델 원문 응답 " + "─" * 44)
        print(f"   {text!r}")
        print("   " + "─" * 62)
        if text is None:
            print("\n   → 호출 실패. 위 로그의 경고 메시지를 확인하세요.")
            return 1
        parsed = ns._parse_notes(text)
        print(f"\n4) 파싱 결과 : {parsed}")
        if parsed is None:
            print("   → JSON 배열을 못 찾았습니다. 모델이 형식을 어겼습니다.")
            return 1
        print("\n5) 필터 통과 후")
        for item in parsed:
            print(f"   {item!r}  →  {ns._sanitize(item)!r}")
        return 0

    notes = ns.generate_notes(query_bytes, targets)
    print("\n4) 최종 결과")
    ok = 0
    for r, n in zip(targets, notes):
        mark = "✅" if n else "❌"
        print(f"   {mark} {r}")
        print(f"      {n!r}")
        ok += bool(n)

    print("\n" + "=" * 66)
    if ok:
        print(f"note {ok}/{len(targets)}건 생성됨 — 정상 동작합니다.")
        return 0
    print("note가 하나도 생성되지 않았습니다.")
    print("위 로그의 경고를 보세요. --raw 로 다시 돌리면 모델 원문까지 나옵니다.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

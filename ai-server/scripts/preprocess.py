"""KIPRIS 벌크 데이터 → 유사도 분석용 메타데이터 생성"""
from pathlib import Path
import pandas as pd

BASE = Path(__file__).parent.parent / "data" / "trademarks"
RAW = BASE / "raw"
META = BASE / "meta"
SEP = "^B"


def load(name: str) -> pd.DataFrame:
    f = next(RAW.rglob(f"TXT/{name}"))
    with open(f, encoding="utf-8") as fh:
        rows = [line.rstrip("\n").split(SEP) for line in fh]
    header, data = rows[0], rows[1:]
    data = [r[:len(header)] + [None] * (len(header) - len(r)) for r in data]
    return pd.DataFrame(data, columns=header)


def build():
    kt10 = load("TB_KT10.txt")
    df = kt10[kt10["상표구분코드명"] == "도형복합"].copy()
    df = df[["출원번호", "출원일자", "등록일자", "상표한글명", "상표영문명",
             "상표구분코드명", "법적상태", "존속기간만료일자"]]

    kt11 = load("TB_KT11.txt").sort_values(["출원번호", "비엔나분류우선순위"])
    primary = kt11.groupby("출원번호")["비엔나분류코드"].first().rename("비엔나_주")
    allcodes = kt11.groupby("출원번호")["비엔나분류코드"].apply("|".join).rename("비엔나_전체")
    df = df.merge(primary, on="출원번호", how="left").merge(allcodes, on="출원번호", how="left")

    kt15 = load("TB_KT15.txt")
    cls = kt15.groupby("출원번호")["류"].apply(lambda s: "|".join(sorted(set(s)))).rename("류")
    sim = kt15.groupby("출원번호")["유사군"].apply(lambda s: "|".join(sorted(set(s.dropna())))).rename("유사군")
    df = df.merge(cls, on="출원번호", how="left").merge(sim, on="출원번호", how="left")

    img_map = {}
    for f in RAW.rglob("IMG/*"):
        img_map.setdefault(f.stem.split("_")[0], f)
    df["이미지경로"] = df["출원번호"].map(
        lambda x: img_map[x].relative_to(BASE).as_posix() if x in img_map else None
    )

    before = len(df)
    df = df[df["이미지경로"].notna()].reset_index(drop=True)

    META.mkdir(parents=True, exist_ok=True)
    out = META / "trademarks.csv"
    df.to_csv(out, index=False, encoding="utf-8-sig")

    print(f"도형복합 {before}건 → 이미지 있는 {len(df)}건 저장")
    print(f"저장 위치: {out}")
    print(f"비엔나 코드 보유: {df['비엔나_주'].notna().sum()}건")
    return df


if __name__ == "__main__":
    build()

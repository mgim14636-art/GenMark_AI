import os

import pandas as pd

from app.core.config import settings
from app.core.logging import logger


class MetadataStore:
    def __init__(self):
        self.path = settings.trademark_metadata_path
        self.load_error: str | None = None
        self.df = self._load()

    def _load(self) -> pd.DataFrame:
        if not os.path.exists(self.path):
            self.load_error = f"metadata csv not found: {self.path}"
            logger.warning("%s. Metadata store is empty.", self.load_error)
            return pd.DataFrame()

        # UTF-8-SIG로 읽어 BOM이 첫 컬럼명에 섞이는 문제를 막는다.
        df = pd.read_csv(self.path, dtype=str, encoding="utf-8-sig")
        df.columns = [c.strip() for c in df.columns]
        logger.info("Metadata loaded: %s records from %s", len(df), self.path)
        return df

    def get(self, idx: int) -> dict:
        if self.df.empty or idx < 0 or idx >= len(self.df):
            return {}
        return self.df.iloc[idx].to_dict()

    def column(self, name: str) -> list:
        if self.df.empty or name not in self.df.columns:
            return []
        return self.df[name].astype(str).str.strip().tolist()

    def __len__(self) -> int:
        return len(self.df)


metadata_store = MetadataStore()

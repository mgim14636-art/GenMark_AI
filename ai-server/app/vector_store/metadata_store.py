import os

import pandas as pd

from app.core.logging import logger

METADATA_CSV = os.path.join("data", "trademarks", "meta", "trademarks.csv")


class MetadataStore:
    def __init__(self):
        self.df = self._load()

    def _load(self) -> pd.DataFrame:
        if os.path.exists(METADATA_CSV):
            df = pd.read_csv(METADATA_CSV, dtype=str)
            logger.info(f"Metadata loaded: {len(df)} records")
            return df
        logger.warning(f"{METADATA_CSV} not found. Metadata store is empty.")
        return pd.DataFrame()

    def get(self, idx: int) -> dict:
        if self.df.empty or idx < 0 or idx >= len(self.df):
            return {}
        return self.df.iloc[idx].to_dict()

    def __len__(self) -> int:
        return len(self.df)


metadata_store = MetadataStore()
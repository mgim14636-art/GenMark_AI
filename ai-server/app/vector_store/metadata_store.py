import json
import os
from app.core.config import settings

class MetadataStore:
    def __init__(self):
        self.metadata_path = settings.metadata_store_path
        self.store = self._load()

    def _load(self):
        if os.path.exists(self.metadata_path):
            with open(self.metadata_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "0": {"trademark_id": "TM-2026-001", "name": "Apex AI Logo"},
            "1": {"trademark_id": "TM-2026-002", "name": "Vortex Design"},
            "2": {"trademark_id": "TM-2026-003", "name": "Quantum Mark"}
        }

    def get(self, idx: int):
        return self.store.get(str(idx), {"trademark_id": f"TM-{idx}", "name": "Unknown Trademark"})

metadata_store = MetadataStore()

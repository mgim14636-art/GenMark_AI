import os

def ensure_directory_exists(path: str):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)

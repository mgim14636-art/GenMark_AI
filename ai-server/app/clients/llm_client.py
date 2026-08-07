class LLMClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key

    def generate_prompt_expansion(self, user_concept: str) -> str:
        return f"{user_concept}, modern vector icon, high resolution, minimalist"

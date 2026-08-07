class PromptService:
    @staticmethod
    def enhance_prompt(raw_prompt: str) -> str:
        prefix = "professional vector logo, minimal design, crisp lines, 8k resolution, vector art style: "
        return prefix + raw_prompt

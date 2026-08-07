package com.genmark.ai.client;

import java.util.List;
import java.util.Map;

public interface LogoAiClient {
    LogoAiResult generate(Map<String, Object> survey);

    record LogoAiResult(boolean success, List<String> logos) {}
}

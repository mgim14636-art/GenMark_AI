package com.genmark.ai.client;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class AiServerClient {

    private final RestClient aiRestClient;

    @SuppressWarnings("unchecked")
    public Map<String, Object> generateLogo(String prompt) {
        return aiRestClient.post()
                .uri("/api/v1/generation/generate")
                .body(Map.of("prompt", prompt))
                .retrieve()
                .body(Map.class);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> checkSimilarity(String imageUrl) {
        return aiRestClient.post()
                .uri("/api/v1/similarity/search")
                .body(Map.of("image_url", imageUrl))
                .retrieve()
                .body(Map.class);
    }
}

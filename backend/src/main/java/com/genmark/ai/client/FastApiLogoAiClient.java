package com.genmark.ai.client;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class FastApiLogoAiClient implements LogoAiClient {
    private final RestClient restClient;

    public FastApiLogoAiClient(@Qualifier("aiRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    @SuppressWarnings("unchecked")
    public LogoAiResult generate(Map<String, Object> survey) {
        Map<String, Object> body = restClient.post().uri("/api/v1/generation/generate")
                .body(survey).retrieve().body(Map.class);
        if (body == null) return new LogoAiResult(false, List.of());

        Object rawLogos = body.get("logos");
        if (!(rawLogos instanceof List<?> list)) return new LogoAiResult(false, List.of());

        List<String> logos = list.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .map(item -> item.get("imageBase64"))
                .filter(String.class::isInstance)
                .map(String.class::cast)
                .filter(value -> !value.isBlank())
                .toList();
        return new LogoAiResult(!logos.isEmpty(), logos);
    }
}

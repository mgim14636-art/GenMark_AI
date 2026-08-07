package com.genmark.ai.client;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Component
public class FlaskLogoAiClient implements LogoAiClient {
    private final RestClient restClient;

    public FlaskLogoAiClient(@Qualifier("logoAiRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    @SuppressWarnings("unchecked")
    public LogoAiResult generate(Map<String, Object> survey) {
        Map<String, Object> body = restClient.post().uri("/generate-logo")
                .body(survey).retrieve().body(Map.class);
        if (body == null) return new LogoAiResult(false, List.of());
        Object rawLogos = body.get("logos");
        List<String> logos = rawLogos instanceof List<?> list
                ? list.stream().filter(String.class::isInstance).map(String.class::cast).toList()
                : List.of();
        return new LogoAiResult(Boolean.TRUE.equals(body.get("success")), logos);
    }
}

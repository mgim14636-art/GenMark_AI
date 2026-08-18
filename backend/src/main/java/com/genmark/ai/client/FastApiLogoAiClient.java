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
        if (body == null) return new LogoAiResult(false, null, List.of());

        Object rawLogos = body.get("logos");
        if (!(rawLogos instanceof List<?> list)) return new LogoAiResult(false, toNonBlankString(body.get("modelName")), List.of());

        List<GeneratedLogo> logos = list.stream()
                .filter(Map.class::isInstance)
                .map(Map.class::cast)
                .map(FastApiLogoAiClient::toGeneratedLogo)
                .filter(java.util.Objects::nonNull)
                .toList();
        return new LogoAiResult(!logos.isEmpty(), toNonBlankString(body.get("modelName")), logos);
    }

    private static GeneratedLogo toGeneratedLogo(Map<?, ?> item) {
        Object image = item.get("imageBase64");
        if (!(image instanceof String value) || value.isBlank()) return null;
        return new GeneratedLogo(value, toInteger(item.get("seed")), toInteger(item.get("variantIndex")),
                toNonBlankString(item.get("svg")));
    }

    private static Integer toInteger(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private static String toNonBlankString(Object value) {
        return value instanceof String string && !string.isBlank() ? string : null;
    }
}

package com.genmark.ai.client;

import com.genmark.ai.web.exception.ApiException;
import com.genmark.ai.web.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class FastApiSvgRasterizerClient implements SvgRasterizerClient {
    private final RestClient restClient;

    public FastApiSvgRasterizerClient(@Qualifier("aiRestClient") RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    @SuppressWarnings("unchecked")
    public String rasterize(String svg) {
        Map<String, Object> body = restClient.post().uri("/api/v1/generation/rasterize-svg")
                .body(Map.of("svg", svg)).retrieve().body(Map.class);
        if (body == null || !(body.get("imageBase64") instanceof String imageBase64)
                || imageBase64.isBlank()) {
            throw new ApiException(ErrorCode.AI_INVALID_RESPONSE, "SVG 래스터 변환 응답이 올바르지 않습니다.");
        }
        return imageBase64;
    }
}
